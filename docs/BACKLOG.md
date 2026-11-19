# BACKLOG

Rules: do tasks in order; one task per session. Status: `todo` | `done` | `blocked` (see QUESTIONS).
`run_loop.ps1` parses `### Txx — title` headings and the `Status:` line directly below. Keep that format.

### T01 — App shell + test harness
Status: done
- `index.html` (dark, landscape-first, loads `css/app.css` and `js/*.js` as classic scripts), `css/app.css` with color/size tokens.
- `js/` UMD stub module `app-info.js` exporting `{ name, version }`.
AC:
- `node --test "tests/*.test.js"` runs and passes, including `tests/smoke.test.js` that requires `js/app-info.js`.
- No `http://`/`https://`/`//cdn` references in `index.html`, `css/`, `js/` (test enforces).
- Opening via a static server shows title + "No routine loaded" with no console errors.

### T02 — Routine validator + expansion
Status: done
- `js/routine.js`: `validateRoutine(obj) -> { ok, errors[], warnings[] }`, `stepDuration(step, defaults)`, `expand(routine) -> flatSteps[]`, `totalDuration(routine)` per SPEC §3 (schema v2: blocks, rounds, restBetweenRounds, secPerRep, perSide).
AC:
- Validation tests: valid routine; missing name; bad type; both/neither reps & seconds; pause with reps; exercise cues ≠ 3; cue > 30 chars; pause without cues is OK; bad `secPerRep`; bad `rounds`/`restBetweenRounds`; empty block; bad clip path (`http:`, `//`, `..`); unknown field → warning only.
- Errors name block/step index and field (e.g. `blocks[1].steps[2].cues: expected 3`).
- Duration tests: reps default 3 s; custom `secPerRep` (TGU 3/side × 20 s = 120 s); `perSide` doubles reps and seconds steps.
- Expansion tests: rounds repeated; `Rest` inserted between rounds but not after the last; flat steps carry block/round/rounds/durationSec.

### T03 — Routine registry + demo routine
Status: done
- `routines/index.json`, `routines/demo.json` (short schema-v2 routine: 1 block × 2 rounds, 3 steps, ~10 s steps, uses `perSide` once, for testing).
- Test: every `routines/*.json` (except index) is valid AND listed in `index.json`; every listed file exists.
AC:
- Adding an unlisted routine file makes the test fail with a clear message.

### T04 — Timer engine (pure, fully automatic)
Status: done
- `js/engine.js`: state machine over expanded flat steps. API: `create(flatSteps, opts)`, `start(nowMs)`, `tick(nowMs)`, `togglePause(nowMs)`, `skip(nowMs)`, `back(nowMs)`, `getState()`. Events: `step`, `beep` (3/2/1), `final-beep`, `finished`.
- Phases: `idle` → `ready` (5 s) → steps → `finished`. Every step timed by `durationSec`; auto-advance at 0. No API waits for "done".
AC:
- Tests with fake clock: auto-advances through all steps with zero input; countdown uses time deltas (one big tick jump crosses steps correctly); pause/resume preserves remaining; skip; back rule (> 3 s restarts, else previous; at step 0 restarts); skip/back while paused stay paused; beeps fire exactly once each at 3,2,1 and final at 0; no beeps while paused; `finished` with total elapsed.

### T05 — Key mapping (pure)
Status: done
- `js/keys.js`: `mapKey(keyOrCode, screen) -> 'start'|'toggle'|'skip'|'back'|'up'|'down'|null` per SPEC §5 table. Screens: `picker`, `run`, `done`.
AC:
- Tests for every row/column in SPEC §5 incl. media keys; unmapped keys → null; no exit/menu action exists during a run.

### T06 — View-model (pure)
Status: done
- `js/view.js`: `toView(engineState) -> { title, badge, countdown, target, blockLabel, index, nextUp, cues[], cuesFor: 'current'|'next', clip, theme, paused }`.
AC:
- Tests: exercise shows own cues; pause shows NEXT step name + target + cues; reps target `×10`, perSide `×10 / side`, seconds steps no target; countdown `m:ss` when ≥ 60 else `ss`; blockLabel `Block A · round 2/3`; last step nextUp = "Finish"; paused flag.

### T07 — Run screen UI wiring (tap-first)
Status: done
- `js/app.js`: picker (routine cards from `routines/index.json`: name, weight, total duration; invalid ones disabled with error), DOM rendering of the view-model, `requestAnimationFrame` loop calling `engine.tick`.
- Tap controls are primary: bottom bar `◀ Back` · `⏯ Pause/Resume` · `▶ Skip` (sizes per SPEC §5), routine cards tappable = Start. Keyboard/remote via `keys.js` as secondary. "PAUSED" overlay. End screen with "Back to routines".
- CSS per SPEC §6 (viewport units, exercise vs rest accent).
AC:
- Test (static): `index.html` contains every element ID `app.js` uses; the three control buttons exist with accessible labels.
- Manual (in self-audit): demo routine runs start→finish with ONE tap and no further input; pause/skip/back work by tap and by keyboard.

### T08 — Beeps (WebAudio)
Status: done
- `js/audio.js`: `createBeeper(AudioContextCtor)`; `unlock()`, `beep()` (~880 Hz, 120 ms), `finalBeep()` (~1320 Hz, 400 ms). Wired to engine events; `unlock()` on Start tap.
AC:
- Tests with a mock AudioContext: correct frequencies/durations scheduled; no throw when AudioContext missing.

### T09 — Fullscreen + Wake Lock
Status: done
- `js/screen.js`: enter fullscreen on Start; wake lock acquire on Start, release on finish, re-acquire on `visibilitychange`.
AC:
- Tests with mocked `document`/`navigator`: acquire/release/re-acquire calls; graceful when APIs absent.

### T10 — Optional exercise clips
Status: done
- Show `<video muted loop playsinline>` for current (or next, during pause) step's clip; hide on error/missing.
AC:
- View-model test: clip chosen correctly for exercise vs pause. Manual: missing clip path shows no broken element.

### T11 — PWA: manifest, icons, service worker
Status: done
- `manifest.webmanifest`, `icons/` (192, 512, maskable; generated locally), `sw.js` with `CACHE_VERSION`, precache list, cache-first, old cache cleanup, skipWaiting/clientsClaim. Register SW in `app.js`.
- Precache = static `APP_SHELL` array + runtime fetch of `routines/index.json` (routines + their clips).
AC:
- Test: every file under `index.html`, `css/`, `js/`, `icons/`, manifest is in `APP_SHELL` (no missing, no stale entries).
- Manual: load once, go offline (DevTools), reload → app + routines work.

### T12 — Release/versioning check + README
Status: done
- `tests/release.test.js`: `CACHE_VERSION` in `sw.js` equals the top released version in CHANGELOG.
- `README.md`: run locally (any static server, e.g. `python -m http.server`), deploy on GitHub Pages (Settings → Pages → main / root), how to add a routine.
AC:
- Test fails if CHANGELOG version and `CACHE_VERSION` differ.

### T13 — First real routine: KB 60 min core + full body
Status: done
- Move `docs/routine-drafts/kb-60-core-full-body.json` (content approved by user, Q01) to `routines/`, register in `routines/index.json`. Fix only schema issues; do not change exercises, reps, timings, or cues without a QUESTIONS entry.
AC:
- Validates with T02; listed in index; T03 registry test passes.
- Test: expanded total duration = 3531 s (≈ 58.9 min) and 78 flat steps (incl. generated round rests); block order Warm-up, Block A, Transition, Block B, Cool-down.

### T14 — TV readability + end-to-end pass
Status: done
- Review sizes/contrast on 1920×1080, 1280×720, phone landscape + portrait; long names/cues shrink or ellipsize.
- Simulated full-run test: engine through the KB 60 routine with fake clock and zero input, assert event sequence and finish time.
AC:
- Contrast of main text/background tokens ≥ 7:1 (test computes from CSS tokens).
- E2E simulation test passes.

### T15 — Rest screen target + TV-readable secondary text
Status: done
- During rest/get-ready, the big countdown has NO target beside it; the next exercise's target shows only in the "Next: <name> ×N" line, which is enlarged. Enlarge status line and "NEXT UP" per SPEC §4/§6.
- Found in browser check: rest showed "13 ×10" (target looked like part of the rest); status line was 3vh, NEXT UP 3.5vh.
AC:
- View-model test: for a pause or get-ready state the countdown-side target is empty and the next exercise's target is exposed separately (e.g. `nextTarget`); exercise steps unchanged.
- CSS test (from tokens/rules): "Next:" line ≥ 7vh, status line ≥ 4.5vh, NEXT UP ≥ 5vh; existing countdown/name/cue minimums still hold.
- Portrait phone (375×812) still fits without overlapping the control bar (state checked in self-audit).

### T16 — End screen total time format
Status: done
- Total time on the end screen shows `m:ss` (`0:58`, `58:51`), `h:mm:ss` from 1 h (`1:02:03`). Found in browser check: showed "Total time 1".
AC:
- Pure `formatTotal(sec)` (in `view.js`) tested for 0, 58, 60, 3531, 3723 s; end screen uses it (static test or view-model test).

### T17 — Cleanup + release v2
Status: todo
- `routines/demo.json`: drop `"weight": "none"`; picker card omits the weight part when a routine has no weight (shows only duration).
- Delete `docs/routine-drafts/` (superseded by `routines/kb-60-core-full-body.json`).
- Release: bump `CACHE_VERSION` in `sw.js` to `"v2"`, rename CHANGELOG `## Unreleased` to `## v2 (<date>)` and add a fresh empty `## Unreleased` above it.
AC:
- Test: picker card label for a routine without weight has no "none"/empty separator (pure helper tested).
- `docs/routine-drafts/` no longer exists; nothing references it except history in QUESTIONS/BACKLOG.
- Release test (T12) passes with v2.
