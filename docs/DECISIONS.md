# DECISIONS (append-only)

Format: `D## (date) — decision. Why. [task]`

- D01 (2026-11-19) — Phone PWA mirrored to TV is the primary target; direct TV browser is best effort. Why: requirements ask for both mobile-first PWA and TV readability; one landscape fullscreen layout serves both. [setup]
- D02 (2026-11-19) — "Single index.html" = single page app; JS/CSS split into `js/*.js`, `css/app.css` (still no build, no deps). Why: pure modules must be `require()`-able by Node tests. [setup]
- D03 (2026-11-19) — Must be served over HTTP(S); `file://` unsupported. Why: `fetch` of routine JSON and service workers do not work on `file://`. Offline is achieved via the service worker after first load. [setup]
- D04 (2026-11-19) — SUPERSEDED by D11. Reps-based steps do not auto-advance; user presses Enter/→ when done. Timed steps auto-advance. Why: reps have no reliable duration. [setup]
- D05 (2026-11-19) — Routines discovered via `routines/index.json` (static hosting cannot list directories). A test enforces every routine file is registered, so "no code change" holds. [setup]
- D06 (2026-11-19) — Tests: Node built-in `node:test`, no npm deps; JS modules use UMD pattern. Why: offline, zero-install. [setup]
- D07 (2026-11-19) — Back (←) restarts the current step if > 3 s elapsed, else goes to previous step (music-player convention). [setup]
- D08 (2026-11-19) — 5 s get-ready countdown before first step. [setup]
- D09 (2026-11-19) — Automation: implementer = fresh `claude -p --model sonnet`; reviewer = fresh `claude -p --model opus`, read-only tools. Script runs tests itself as the authoritative gate. Implementer commits; script pushes only after APPROVE. [setup]
- D10 (2026-11-19) — Routines authored as blocks with `rounds` + `restBetweenRounds`; `expand()` flattens to timed steps at load. Engine/view only see flat steps. Why: compact, readable JSON for 3-round circuits; engine stays simple. Rest is inserted between rounds only, never after the last. [Q01]
- D11 (2026-11-19) — Supersedes D04. Fully automatic: every step is timed, nothing waits for input. Reps duration = `reps × secPerRep × (perSide ? 2 : 1)`, `secPerRep` default 3 s (per-step override, e.g. Turkish get-up 20 s). Timed `perSide` steps double too. UI shows `×N` / `×N / side` plus countdown. [user change 1]
- D12 (2026-11-19) — Only user controls: Start (once), Pause/Resume, Skip, Back. Primary input = large on-screen tap buttons; keyboard/remote secondary. No exit/menu/fullscreen-toggle keys during a run. Back/Skip keep paused state. [user change 1]
- D13 (2026-11-19) — Pause steps may omit cues (they display the next exercise's cues). Exercises still need exactly 3. [Q01]
- D14 (2026-11-19) — "10/direction" (halo) modeled as `perSide: true`; displayed as "/ side". Routine includes a pause after the last warm-up exercise of each round, as written by the user. [Q01]
- D15 (2026-11-19) — Validator: exercise with missing `cues` errors as `cues: expected 3`; clips reject any URL scheme, `//`, leading `/` or `\`, and `..` segments; `perSide` must be boolean. Expanded flat steps always have `cues` (array, `[]` for Rest) and `perSide` (bool); `reps` only on reps steps; generated Rest carries the block name and the round it follows. [T02]
