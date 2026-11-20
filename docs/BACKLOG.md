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
Status: done
- `routines/demo.json`: drop `"weight": "none"`; picker card omits the weight part when a routine has no weight (shows only duration).
- Delete `docs/routine-drafts/` (superseded by `routines/kb-60-core-full-body.json`).
- Release: bump `CACHE_VERSION` in `sw.js` to `"v2"`, rename CHANGELOG `## Unreleased` to `## v2 (<date>)` and add a fresh empty `## Unreleased` above it.
AC:
- Test: picker card label for a routine without weight has no "none"/empty separator (pure helper tested).
- `docs/routine-drafts/` no longer exists; nothing references it except history in QUESTIONS/BACKLOG.
- Release test (T12) passes with v2.

### T18 — Adjustable rep pace (global sec/rep + per-exercise overrides)
Status: done
- User request: change the "seconds per rep" assumption without editing JSON, including the Turkish get-up's own pace. SPEC §3 (duration), §4a (pace settings); D30.
- New pure UMD module `js/pace.js` (add to `index.html` before `app.js`, and to `APP_SHELL` in `sw.js`): `normalize(obj)` (drops invalid values), `stepValue(value, dir, kind)` (stepper rules from SPEC §4a), `overridable(routines)` (sorted distinct names of exercise steps with their own `secPerRep` across the given routines, with that base value).
- `js/routine.js`: `stepDuration(step, defaults, pace?)`, `expand(routine, pace?)`, `totalDuration(routine, pace?)` use the effective sec/rep from SPEC §3. If `pace` is omitted, the result is the same as today.
- `js/app.js`: a "Pace" panel at the top of the picker (SPEC §4a): a "Seconds per rep" stepper plus one stepper row per overridable exercise, and a Reset button. Card durations update live. The run uses the pace in effect when it starts. Saved to localStorage (`kb-timer-pace`) with read/write in try/catch; the app works if storage is unavailable.
- Pace buttons blur after a tap (like the run controls), so Enter/Space still start the selected routine. The keyboard mapping (D18) is unchanged.
AC:
- Routine tests: without a pace, all existing durations are unchanged (KB 60 still 3531 s). With `{secPerRep: 4}`, a 15-rep step without its own sec/rep = 60 s and the TGU stays 120 s. With `{exercises: {"Turkish get-up": 30}}`, the TGU = 3 × 30 × 2 = 180 s. Precedence: exercise override > step `secPerRep` > pace `secPerRep` > routine default > 3.
- Pace tests: `normalize` rejects non-numbers, values ≤ 0 and values outside the limits; `stepValue` follows the step sizes and limits (including from null = "routine" default); `overridable` on KB 60 + demo returns Turkish get-up (20) and Halo (1).
- Static UI test: the pace panel's element IDs used by `app.js` exist in `index.html`; `js/pace.js` is in `APP_SHELL` and loaded by `index.html`.
- Self-audit: in the browser, changing the pace updates card totals; the setting survives a reload.

### T19 — Exercise picture beside the rest countdown
Status: done
- User request: during rest and get-ready, show a picture of the NEXT exercise beside the big countdown, so it is recognized faster than from the word cues. SPEC §3 (`clip` may be an image), §4, §6; D31.
- `clip` may be a video (`.mp4`, `.webm`) or an image (`.svg`, `.gif`, `.webp`, `.png`, `.jpg`, `.jpeg`). Validator: any other extension is an error (`clip: unsupported type`).
- View-model: `media = { src, kind: 'video'|'image' }` or null. Rest/get-ready: the next exercise's clip. Exercise steps: null (no media during exercise; this replaces T10's below-cues video).
- DOM: `#run-clock` becomes countdown | media side by side (landscape). `<img id="run-img">` for images, the existing `<video id="run-clip">` for videos. Hidden on missing or error. `src` changes only when the path changes. Media height ≥ 25vh in landscape. In portrait (375×812) it may shrink but must not overlap the control bar.
AC:
- Routine tests: image and video extensions are accepted; `.txt`/no extension are rejected; the existing path-safety rules are unchanged.
- View tests: rest → next step's media with the right `kind`; get-ready → step 1's media; exercise → null; a next step without a clip → null.
- Static/CSS tests: `#run-img` exists; the media rule in `css/app.css` has a height ≥ 25vh; existing size tests still pass.
- Self-audit: at 1280×720 and 375×812, a rest with an SVG clip shows countdown + picture side by side, with no overlap.

### T20 — Stick-figure pictures for every exercise
Status: todo
- User request: original animated stick figures (drawn in SVG by the implementer) for every exercise in `routines/kb-60-core-full-body.json`: Two-hand swing, Goblet squat, Halo, Deadlift, Goblet reverse lunge, Single-arm row, Single-arm overhead press, Turkish get-up, Suitcase march, Dead bug, Hollow hold, Plank pull-through, Russian twist, Leg & hip stretch (+ any other exercise names in that file). D32.
- Files: `clips/<lowercase-kebab-name>.svg` (e.g. `clips/turkish-get-up.svg`, `clips/leg-hip-stretch.svg`). Square `viewBox="0 0 200 200"`, transparent background, side view unless another view is clearer. Figure: round head + thick lines, stroke `#ffffff`, `stroke-width` ≥ 6, round caps. Kettlebell (handle + body) in `#ffb300`. A floor line in `#b0b0b0`.
- Animation: SMIL only (`<animate>` on `d`/`points`/coords or `<animateTransform>`), loop `repeatCount="indefinite"`, cycle 1.5–4 s, 2–4 key poses showing the movement's start and end position (e.g. swing: hinge → standing with bell at chest height; TGU: lying → seated → standing). No `<script>`, no `<image>`, no `<text>`, no external references (no `http`, no `href` to files). Each file ≤ 8 KB.
- Add `"clip": "clips/<name>.svg"` to every exercise step in KB 60 (both Goblet squat occurrences share one file) and to the demo Halo step. Change nothing else in the routines (totals stay pinned).
AC:
- Test (`tests/clips.test.js`): every exercise step in KB 60 has a `clip`; every clip referenced by any routine exists; each SVG starts with `<svg`, has `viewBox="0 0 200 200"`, contains `<animate`, contains none of `<script`, `<image`, `<text`, `http`, `href=`, and is ≤ 8 KB; file names are lowercase-kebab.
- Registry/E2E tests still pass (KB 60 3531 s / 78 steps unchanged).
- Self-audit: list each file with the key poses drawn.
