# CLAUDE.md — rules for every session

Project: offline kettlebell workout timer (phone PWA, mirrored to TV). Plain HTML/CSS/JS, no build, no dependencies.

## 0. Read first (always, in this order)
1. `CLAUDE.md` (this file)
2. `docs/SPEC.md` — what the product must do. Source of truth.
3. `docs/BACKLOG.md` — ordered tasks + acceptance criteria.
4. `docs/DECISIONS.md` — decisions already made. Do not re-litigate them.
5. `docs/QUESTIONS.md` — open questions; never work around an open question.

## 1. One task per session
- Pick the FIRST task in `docs/BACKLOG.md` with `Status: todo` (or the task ID you were given).
- Do exactly that ONE task. No extra features, no refactors outside its scope, no work on later tasks.
- When the task is committed, STOP.

## 2. Workflow (every task)
1. **Plan**: re-read the task's acceptance criteria (AC) and the SPEC sections it touches.
2. **Tests first or alongside**: add/update tests in `tests/*.test.js` covering every AC that can be tested in Node.
3. **Implement** the smallest change that meets the AC.
4. **Run tests**: `node --test "tests/*.test.js"` — ALL must pass. Never commit with failing tests. Never delete/skip a test to make it pass.
5. **Self-audit** (write it in your final message, see §5).
6. **Update docs**:
   - `docs/BACKLOG.md`: set the task `Status: done`.
   - `docs/DECISIONS.md`: add an entry for any non-trivial choice you made.
   - `docs/CHANGELOG.md`: add a line under `## Unreleased`.
   - `docs/SPEC.md`: only if the task explicitly changes the spec.
7. **Commit**: `git add -A && git commit -m "<TASK-ID>: <short summary>"`. One commit per task (a fix-up commit after review is fine). Do NOT push — `run_loop.ps1` pushes after approval.

## 3. When blocked or a decision is needed
- A decision is "needed" if it changes user-visible behavior not covered by SPEC/DECISIONS, or the task is ambiguous/impossible as written.
- Append to `docs/QUESTIONS.md` using its template (`Status: open`), set the task `Status: blocked` in BACKLOG, commit the doc change, and STOP. Do not guess.
- Small internal choices (naming, file layout inside the rules below): decide, record in DECISIONS, continue.

## 4. Hard technical rules
- 100% offline: no CDN, no external URLs, no npm runtime dependencies, no build step. Fonts = system fonts.
- App entry is `index.html`. JS in `js/*.js` as classic scripts using the UMD pattern below so the same file loads in the browser AND `require()`s in Node tests:
  ```js
  (function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Engine = factory();
  })(typeof self !== 'undefined' ? self : this, function () { /* ... */ return { /* api */ }; });
  ```
- Keep logic pure and DOM-free where possible (engine, routine validation, key mapping, view-model) so it is testable in Node. DOM/Audio/WakeLock code stays thin.
- Tests: Node built-in runner only (`node:test`, `node:assert`). No jsdom, no test deps.
- Routines are data: `routines/*.json` + listed in `routines/index.json`. Adding a routine must never require a code change.
- Every release bumps `CACHE_VERSION` in `sw.js` and `version` in `js/app-info.js` to the same `vN` (see SPEC §7).
- Developed on Windows, served from GitHub Pages (case-sensitive): use forward-slash relative paths in code; keep file names lowercase-kebab.

## 5. Self-audit (end of every implementer session)
Final message must contain, in this format:
```
TASK: <ID> <title>
TESTS: <command> -> <pass/fail counts>
AC CHECK: one line per AC -> met / not met (+ how verified)
SPEC CHECK: SPEC sections touched -> consistent? (yes/no + note)
FILES: changed files
RISKS: bullet list (untested-in-browser parts, edge cases, TV/phone concerns)
```

## 6. Reviewer sessions
A separate fresh session reviews each task (see `run_loop.ps1`). Reviewers are read-only: they do not edit files. They end with exactly one line `VERDICT: APPROVE` or `VERDICT: REJECT`. If you are an implementer and receive reviewer feedback, fix only what was raised, re-run tests, commit as `<TASK-ID>: review fixes`.

## 7. Doc style (docs are read by LLMs)
- Concise, structured: headings, bullets, IDs (T01, D01, Q01). No prose padding.
- Never rewrite history in DECISIONS/CHANGELOG; append.
- Keep each doc under ~300 lines; summarize old entries if it grows.

## 8. Automation
`run_loop.ps1` drives the loop: for each `todo` task → fresh implementer session (sonnet) → test gate → fresh reviewer session (opus) → on APPROVE push; on REJECT one fix attempt, second REJECT stops the loop. Stops on test failure or new open question. Logs to `logs/`.
