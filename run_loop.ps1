<#
.SYNOPSIS
  Backlog loop: for each `todo` task in docs/BACKLOG.md run a fresh implementer
  session (sonnet), gate on tests, then a fresh independent reviewer session (opus).
  APPROVE -> git push, next task. REJECT -> one fix attempt; second REJECT stops.
  Stops on: test failure, implementer error/no commit, new open QUESTIONS, 2x reject, push failure.
  Every run is logged to logs/.

.EXAMPLE
  .\run_loop.ps1                    # run all todo tasks
  .\run_loop.ps1 -MaxTasks 1        # one task only
  .\run_loop.ps1 -TaskId T04        # start with a specific task
  .\run_loop.ps1 -NoPush            # don't push after approval

  Exit codes: 0 ok/no tasks, 2 precondition, 3 new question, 4 tests failed,
              5 rejected twice, 6 push failed, 7 implementer failed/no commit, 8 reviewer failed
  NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
#>
[CmdletBinding()]
param(
    [int]$MaxTasks = 100,
    [string]$TaskId = '',
    [string]$ImplModel = 'sonnet',
    [string]$ReviewModel = 'opus',
    [int]$MaxTurns = 0,          # 0 = claude default
    [switch]$NoPush,
    [switch]$SkipPermissions     # pass --dangerously-skip-permissions to the implementer (use with care)
)

$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$LogDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$RunStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$MainLog = Join-Path $LogDir "loop-$RunStamp.log"

$TestCmd = @('--test', 'tests/*.test.js')

$ImplTools = @(
    'Read', 'Edit', 'Write', 'Glob', 'Grep',
    'Bash(node:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git status:*)',
    'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(ls:*)', 'Bash(mkdir:*)'
)
$ReviewTools = @(
    'Read', 'Glob', 'Grep',
    'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(git show:*)', 'Bash(git status:*)', 'Bash(node:*)', 'Bash(ls:*)'
)
$ReviewDenied = @('Edit', 'Write', 'NotebookEdit')

# ---------------------------------------------------------------- helpers
function Write-Log([string]$Msg) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Msg
    Write-Host $line
    Add-Content -LiteralPath $MainLog -Value $line -Encoding UTF8
}

function Invoke-Native {
    param([string]$Exe, [string[]]$ArgList, [string]$InputText = '')
    $out = $null
    if ($InputText -ne '') { $out = $InputText | & $Exe @ArgList 2>&1 | ForEach-Object { "$_" } }
    else { $out = & $Exe @ArgList 2>&1 | ForEach-Object { "$_" } }
    [pscustomobject]@{ Code = $LASTEXITCODE; Text = (@($out) -join "`n") }
}

function Save-Log([string]$Name, [string]$Text) {
    $path = Join-Path $LogDir ("{0}-{1}.log" -f $RunStamp, $Name)
    [System.IO.File]::WriteAllText($path, $Text, $utf8)
    return $path
}

function Get-Tasks {
    # Heading format: "### T01 <dash> Title" ; Status line within the next 3 lines.
    $lines = [System.IO.File]::ReadAllLines((Join-Path $PSScriptRoot 'docs/BACKLOG.md'), $utf8)
    $tasks = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^###\s+(T\d+)\s+\S+\s+(.+?)\s*$') {
            $id = $Matches[1]; $title = $Matches[2]; $status = 'unknown'
            $end = [Math]::Min($i + 4, $lines.Count)
            for ($j = $i + 1; $j -lt $end; $j++) {
                if ($lines[$j] -match '^Status:\s*(\w+)') { $status = $Matches[1].ToLower(); break }
            }
            $tasks += [pscustomobject]@{ Id = $id; Title = $title; Status = $status }
        }
    }
    return $tasks
}

function Get-OpenQuestionCount {
    $text = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'docs/QUESTIONS.md'), $utf8)
    return ([regex]::Matches($text, '(?m)^Status:\s*open\b')).Count
}

function Get-Head { (Invoke-Native git @('rev-parse', 'HEAD')).Text.Trim() }

function Test-CleanTree { ((Invoke-Native git @('status', '--porcelain')).Text.Trim() -eq '') }

function Invoke-Claude {
    param([string]$Model, [string]$Prompt, [string[]]$Tools, [string[]]$Denied, [string]$Mode, [string]$LogName, [switch]$Skip)
    $cli = @('-p', '--model', $Model, '--output-format', 'text')
    if ($MaxTurns -gt 0) { $cli += @('--max-turns', "$MaxTurns") }
    if ($Skip) { $cli += '--dangerously-skip-permissions' }
    else { $cli += @('--permission-mode', $Mode) }
    if ($Denied) { $cli += '--disallowedTools'; $cli += $Denied }
    $cli += '--allowedTools'; $cli += $Tools
    Write-Log "claude ($Model) start: $LogName"
    $t0 = Get-Date
    $r = Invoke-Native claude $cli $Prompt
    $secs = [int]((Get-Date) - $t0).TotalSeconds
    $path = Save-Log $LogName ("MODEL: $Model`nEXIT: $($r.Code)`nSECONDS: $secs`n`n===== PROMPT =====`n$Prompt`n`n===== OUTPUT =====`n$($r.Text)")
    Write-Log "claude ($Model) exit=$($r.Code) in ${secs}s -> $path"
    return $r
}

function Invoke-Tests([string]$LogName) {
    $r = Invoke-Native node $TestCmd
    $path = Save-Log $LogName $r.Text
    Write-Log "tests exit=$($r.Code) -> $path"
    return ($r.Code -eq 0)
}

function Stop-Loop([int]$Code, [string]$Why) {
    Write-Log "STOP ($Code): $Why"
    exit $Code
}

# ---------------------------------------------------------------- prompts
function Get-ImplPrompt($Task, [string]$Feedback) {
    $p = @"
You are the IMPLEMENTER in a fresh session. Follow CLAUDE.md exactly.
Task: $($Task.Id) - $($Task.Title)

1. Read CLAUDE.md, docs/SPEC.md, docs/BACKLOG.md, docs/DECISIONS.md, docs/QUESTIONS.md.
2. Implement ONLY task $($Task.Id) so that all of its acceptance criteria are met. Nothing else.
3. Write/update tests. Run: node --test "tests/*.test.js"  (Bash tool). All tests must pass.
4. Update docs: docs/BACKLOG.md (task Status: done), docs/CHANGELOG.md, docs/DECISIONS.md (if you made choices).
5. Commit: git add -A && git commit -m "$($Task.Id): <summary>". Do NOT push.
6. If blocked or a product decision is needed: append an open question to docs/QUESTIONS.md
   (template in that file), set the task Status: blocked, commit, and stop.
7. End with the self-audit block from CLAUDE.md section 5.
"@
    if ($Feedback) {
        $p += @"

---
An independent reviewer REJECTED the previous attempt at this task (already committed).
Fix ONLY the blocking issues below, re-run tests, update docs if needed, and commit as "$($Task.Id): review fixes".
Reviewer report:
$Feedback
"@
    }
    return $p
}

function Get-ReviewPrompt($Task, [string]$Base) {
    return @"
You are an independent REVIEWER in a fresh session. You did not write this code. Do NOT modify any file.
Task under review: $($Task.Id) - $($Task.Title)
Changes: commits $Base..HEAD. Inspect with: git log --stat $Base..HEAD  and  git diff $Base..HEAD

Read CLAUDE.md, docs/SPEC.md, docs/BACKLOG.md (task $($Task.Id)), docs/DECISIONS.md, then check:
1. Every acceptance criterion of $($Task.Id) is actually met (verify in code and tests, not in claims).
2. Consistent with SPEC and DECISIONS; no scope creep into other tasks.
3. CLAUDE.md section 4 rules: offline, no CDN/deps, UMD modules, pure logic testable in Node.
4. Tests are meaningful (not trivial, none skipped/deleted) and node --test "tests/*.test.js" passes.
5. Docs: BACKLOG status done, CHANGELOG line, DECISIONS entry for non-trivial choices.
6. Real bugs, edge cases, TV readability (size/contrast) issues.

Output: findings as two lists, BLOCKING and NON-BLOCKING (file:line, one line each).
REJECT only for blocking issues (unmet AC, failing/missing tests, spec or rule violation, real bug).
The LAST line of your output must be exactly one of:
VERDICT: APPROVE
VERDICT: REJECT
"@
}

# ---------------------------------------------------------------- preconditions
Write-Log "run_loop start (impl=$ImplModel, review=$ReviewModel, max=$MaxTasks, push=$(-not $NoPush))"
foreach ($exe in @('git', 'node', 'claude')) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { Stop-Loop 2 "'$exe' not found in PATH" }
}
if ((Invoke-Native git @('rev-parse', '--verify', 'HEAD')).Code -ne 0) { Stop-Loop 2 'No commits yet. Make an initial commit first.' }
if (-not (Test-CleanTree)) { Stop-Loop 2 'Working tree not clean. Commit or stash first.' }
if (-not (Invoke-Tests 'baseline-tests')) { Stop-Loop 4 'Baseline tests fail before any task. Fix first.' }

$hasRemote = ((Invoke-Native git @('remote', 'get-url', 'origin')).Code -eq 0)
if (-not $hasRemote -and -not $NoPush) { Write-Log 'WARN: no origin remote; pushes will be skipped.' }

# ---------------------------------------------------------------- main loop
$completed = 0
while ($completed -lt $MaxTasks) {
    $tasks = Get-Tasks
    $task = $null
    if ($TaskId -and $completed -eq 0) {
        $task = $tasks | Where-Object { $_.Id -eq $TaskId } | Select-Object -First 1
        if (-not $task) { Stop-Loop 2 "Task $TaskId not found in BACKLOG" }
        if ($task.Status -ne 'todo') { Stop-Loop 2 "Task $TaskId status is '$($task.Status)', not todo" }
    } else {
        $task = $tasks | Where-Object { $_.Status -eq 'todo' } | Select-Object -First 1
    }
    if (-not $task) {
        $blocked = ($tasks | Where-Object { $_.Status -eq 'blocked' } | ForEach-Object { $_.Id }) -join ', '
        Write-Log "No todo tasks left. Blocked: $(if ($blocked) { $blocked } else { 'none' })"
        break
    }

    Write-Log "=== $($task.Id): $($task.Title) ==="
    $base = Get-Head
    $lastHead = $base
    $q0 = Get-OpenQuestionCount
    $feedback = ''
    $approved = $false

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $tag = '{0}-a{1}' -f $task.Id, $attempt

        # --- implement (fresh session)
        $impl = Invoke-Claude -Model $ImplModel -Prompt (Get-ImplPrompt $task $feedback) -Tools $ImplTools `
            -Mode 'acceptEdits' -LogName "$tag-impl" -Skip:$SkipPermissions
        if ($impl.Code -ne 0) { Stop-Loop 7 "$($task.Id): implementer session failed (exit $($impl.Code))" }

        if ((Get-OpenQuestionCount) -gt $q0) { Stop-Loop 3 "$($task.Id): new open question in docs/QUESTIONS.md - answer it, then rerun" }
        if (-not (Test-CleanTree)) { Stop-Loop 7 "$($task.Id): implementer left uncommitted changes" }
        $headNow = Get-Head
        if ($headNow -eq $lastHead) { Stop-Loop 7 "$($task.Id): implementer made no new commit" }
        $lastHead = $headNow

        # --- test gate (authoritative, run by this script)
        if (-not (Invoke-Tests "$tag-tests")) { Stop-Loop 4 "$($task.Id): tests failed after implementation" }

        # --- review (fresh, independent session)
        $rev = Invoke-Claude -Model $ReviewModel -Prompt (Get-ReviewPrompt $task $base) -Tools $ReviewTools `
            -Denied $ReviewDenied -Mode 'default' -LogName "$tag-review"
        if ($rev.Code -ne 0) { Stop-Loop 8 "$($task.Id): reviewer session failed (exit $($rev.Code))" }
        if (-not (Test-CleanTree)) { Stop-Loop 8 "$($task.Id): reviewer modified the working tree" }

        $verdicts = [regex]::Matches($rev.Text, '(?m)^\s*\**VERDICT:\s*(APPROVE|REJECT)')
        $verdict = if ($verdicts.Count -gt 0) { $verdicts[$verdicts.Count - 1].Groups[1].Value } else { 'REJECT' }
        Write-Log "$($task.Id) attempt ${attempt}: $verdict$(if ($verdicts.Count -eq 0) { ' (no verdict line found)' })"

        if ($verdict -eq 'APPROVE') { $approved = $true; break }
        $feedback = $rev.Text
    }

    if (-not $approved) { Stop-Loop 5 "$($task.Id): rejected twice - human review needed (see logs)" }

    # --- push after approval
    if (-not $NoPush -and $hasRemote) {
        $branch = (Invoke-Native git @('rev-parse', '--abbrev-ref', 'HEAD')).Text.Trim()
        $push = Invoke-Native git @('push', '-u', 'origin', $branch)
        Save-Log "$($task.Id)-push" $push.Text | Out-Null
        if ($push.Code -ne 0) { Stop-Loop 6 "$($task.Id): git push failed (see log)" }
        Write-Log "$($task.Id): pushed to origin/$branch"
    }

    $completed++
    Write-Log "$($task.Id): APPROVED ($completed done this run)"
}

Write-Log "run_loop end: $completed task(s) completed"
exit 0
