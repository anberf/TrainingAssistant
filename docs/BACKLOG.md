# BACKLOG

Rules: do tasks in order; one task per session. Status: `todo` | `done` | `blocked` (see QUESTIONS).
`run_loop.ps1` parses `### Txx — title` headings and the `Status:` line directly below. Keep that format.

## Done T01–T17 (summary; full text and AC in git history before T22)
- T01 app shell + test harness · T02 routine validator + expansion · T03 routine registry + demo · T04 timer engine · T05 key mapping · T06 view-model · T07 run screen UI · T08 beeps · T09 fullscreen + wake lock · T10 clips · T11 PWA/service worker · T12 release check + README · T13 KB 60 routine · T14 TV readability + E2E · T15 rest-screen target · T16 end-screen time format · T17 cleanup + v2.

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
Status: done
- User request: original animated stick figures (drawn in SVG by the implementer) for every exercise in `routines/kb-60-core-full-body.json`: Two-hand swing, Goblet squat, Halo, Deadlift, Goblet reverse lunge, Single-arm row, Single-arm overhead press, Turkish get-up, Suitcase march, Dead bug, Hollow hold, Plank pull-through, Russian twist, Leg & hip stretch (+ any other exercise names in that file). D32.
- Files: `clips/<lowercase-kebab-name>.svg` (e.g. `clips/turkish-get-up.svg`, `clips/leg-hip-stretch.svg`). Square `viewBox="0 0 200 200"`, transparent background, side view unless another view is clearer. Figure: round head + thick lines, stroke `#ffffff`, `stroke-width` ≥ 6, round caps. Kettlebell (handle + body) in `#ffb300`. A floor line in `#b0b0b0`.
- Animation: SMIL only (`<animate>` on `d`/`points`/coords or `<animateTransform>`), loop `repeatCount="indefinite"`, cycle 1.5–4 s, 2–4 key poses showing the movement's start and end position (e.g. swing: hinge → standing with bell at chest height; TGU: lying → seated → standing). No `<script>`, no `<image>`, no `<text>`, no external references (no `http`, no `href` to files). Each file ≤ 8 KB.
- Add `"clip": "clips/<name>.svg"` to every exercise step in KB 60 (both Goblet squat occurrences share one file) and to the demo Halo step. Change nothing else in the routines (totals stay pinned).
AC:
- Test (`tests/clips.test.js`): every exercise step in KB 60 has a `clip`; every clip referenced by any routine exists; each SVG starts with `<svg`, has `viewBox="0 0 200 200"`, contains `<animate`, contains none of `<script`, `<image`, `<text`, `http`, `href=`, and is ≤ 8 KB; file names are lowercase-kebab.
- Registry/E2E tests still pass (KB 60 3531 s / 78 steps unchanged).
- Self-audit: list each file with the key poses drawn.

### T21 — Picture stays still while the countdown ticks
Status: done
- User report (phone): during rest/get-ready the picture/video beside the countdown shifts sideways when the countdown's width changes (e.g. `10` → `9`, `1:00` → `59`), because `#run-clock` is a centered flex row sized by its content. SPEC §4 (Picture), §6; D31, D34.
- Fix in CSS (and markup only if needed): the media (`#run-img`, `#run-clip`) keeps the same on-screen position for the whole rest/get-ready, whatever the countdown shows (`m:ss`, `ss`, 1 or 2 digits). E.g. give the countdown a fixed width wide enough for its longest rest/get-ready value (`ch`-based, keep `tabular-nums`) or use a fixed grid column, so the countdown's width does not move the media. Exercise steps (countdown + `×N` target, no media) must not get worse.
- Keep existing sizes/rules: countdown ≥ 30vh, media height ≥ 25vh landscape, portrait (375×812) no overlap with the control bar; landscape order countdown left, picture right.
- Release v8: bump `CACHE_VERSION` in `sw.js` and `version` in `js/app-info.js` to `v8`; CHANGELOG `## v8 (date)` section.
AC:
- Static CSS test (`tests/ui.test.js`): `#run-countdown` has a fixed width that does not depend on content (e.g. a `width`/`min-width` in `ch`, ≥ 4ch to fit `m:ss`; or an equivalent fixed grid track for the countdown) and keeps `font-variant-numeric: tabular-nums`; existing size tests (countdown ≥ 30vh, media ≥ 25vh) still pass.
- Release test passes with `v8` in both files.
- Self-audit: explain why the media x-position no longer depends on the countdown text (1-digit, 2-digit, `m:ss`), and that nothing overflows at 1280×720 and 375×812.

### T22 — Published routine changes reach every device
Status: done
- User change 4 (D39). Today `sw.js` serves `routines/*` cache-first, so a routine added/renamed on GitHub is invisible to phones that already opened the app until a release. SPEC §7.
- `sw.js` fetch: requests whose path is under `routines/` (index.json + routine files) are **network-first**: fetch from network; on success put the response in the current cache and return it; on network error or non-ok response return the cached copy; if neither exists, return the network response/error. Everything else (app shell, clips) stays cache-first. Install-time precache unchanged.
AC:
- `tests/pwa.test.js` (vm sandbox, mocked `fetch`/`caches`): for `routines/index.json` the network copy wins over a cached copy and is written to the cache; with the network failing, the cached copy is returned; for `clips/x.webp` and `js/app.js` a cached copy is returned without calling `fetch`.
- All existing tests pass (APP_SHELL unchanged).

### T23 — Owner mode (PIN)
Status: done
- User change 4 (D40, D41). SPEC §4b. Hides edit controls from everyone but the owner. NOT security: the real protection is that only the owner can push to GitHub.
- New pure UMD module `js/owner.js` (global `Owner`; add to `index.html` before `app.js` and to `APP_SHELL`): `sha256Hex(str)` (pure JS, synchronous, UTF-8, no WebCrypto), `hashPin(pin)` = `sha256Hex('training-assistant:' + pin)`, `checkPin(pin, hash)` (false when hash is empty/invalid).
- New `js/owner-config.js` (UMD, global `OwnerConfig = { pinHash: '' }`; in `index.html` + `APP_SHELL`). Empty hash = owner mode cannot be unlocked (panel shows "No PIN set").
- New `tools/set-pin.js` (Node, run by the owner locally): asks for the PIN twice on stdin (never via argv), requires 4–12 digits, rewrites `js/owner-config.js` with the hash, prints next steps (commit + push). Never prints or stores the PIN itself. Exports its pure helpers (`validPin`, `configText`) and only prompts when run as main.
- Picker: small "Owner" button below `#app-version`. Tap → inline panel `#owner-panel` with a password input (`inputmode="numeric"`), "Unlock" and "Cancel". Correct PIN → owner mode on, stored in localStorage `kb-timer-owner` = the hash (owner mode is on only while the stored value === `OwnerConfig.pinHash`, so a new PIN re-locks old devices). Wrong PIN → "Wrong PIN", stays locked. When unlocked the button reads "Lock" and turns owner mode off. Storage read/write in try/catch.
- `#app` gets `data-owner="on"|"off"`; T24–T27 controls show only when on.
- The `keydown` handler ignores events whose target is an `input`, `textarea` or `select` (typing a PIN + Enter must not start a routine). Key mapping (D18) unchanged.
AC:
- `tests/owner.test.js`: `sha256Hex('')` and `sha256Hex('abc')` equal the standard SHA-256 test vectors and equal Node `crypto` for several strings incl. non-ASCII; `checkPin` true for the right PIN, false for a wrong PIN and for an empty hash.
- `tools/set-pin.js` helpers: `configText(hash)` is valid JS that sets `OwnerConfig.pinHash` (load it in a `vm` sandbox); `validPin` rejects `123`, `abcd`, 13 digits and accepts `1234`.
- Static UI test: owner element IDs used by `app.js` exist in `index.html`; `js/owner.js` and `js/owner-config.js` are loaded by `index.html` (before `app.js`) and are in `APP_SHELL`; `app.js` keydown handler has the form-field guard.
- Self-audit: in the browser (with a temporary local hash, not committed), wrong PIN stays locked; right PIN unlocks and survives reload; Lock turns it off; Enter in the PIN field does not start a routine. Commit `js/owner-config.js` with an EMPTY hash.

### T24 — Owner: rename and remove routines (unpublished drafts)
Status: done
- User change 4 (D42). SPEC §4b.
- New pure UMD module `js/drafts.js` (global `Drafts`; in `index.html` + `APP_SHELL`). Drafts = `{ routines: { "<file>": routineObj }, removed: ["<file>"] }`. Functions: `normalize(obj)`; `rename(drafts, file, baseRoutine, newName)` (stores a copy of the routine with only `name` changed, trimmed; blank → error); `remove(drafts, file)`; `undo(drafts, file)` (drops that file's draft and removal); `apply(entries, drafts)` → entries with draft routines replacing loaded ones (`unpublished: true`), removed ones `removed: true`, and draft-only files (new routines, T26) appended; `isEmpty(drafts)`. All pure, inputs never mutated.
- Saved in localStorage `kb-timer-drafts` (try/catch). Drafts are applied ONLY while owner mode is on; other devices never see them.
- Picker in owner mode: each routine card gets "Rename" and "Remove" buttons (tap only, outside the card's Start button, blur after tap). Rename = inline text input + Save/Cancel (Enter in the input saves, never starts a routine). Removed cards stay listed, greyed, "Removed — unpublished", with "Undo", and cannot be started (keyboard selection skips them). Changed cards show an "unpublished" tag. Rename changes only the display `name`; file name and `id` stay (D42).
AC:
- `tests/drafts.test.js`: rename keeps every field except `name` identical and does not mutate the input; blank name rejected; remove + undo; `apply` marks unpublished/removed and appends draft-only files; `normalize` drops garbage.
- Static UI test: new IDs used by `app.js` exist in `index.html`; `js/drafts.js` in `index.html` + `APP_SHELL`.
- Self-audit: in owner mode rename a routine → new name and same card total, survives reload; Remove + Undo; owner mode off → original names, no edit buttons.

### T25 — Default exercise picture by name
Status: done
- User change 4 (D43). SPEC §3 (clip), §4 (Picture), §7.
- `Routine.clipName(name)`: lowercase; every run of characters other than `a–z0–9` → `-`; trim `-` at both ends (`Leg & hip stretch` → `leg-hip-stretch`, `Single-arm row` → `single-arm-row`).
- An exercise step without `clip` gets an implicit picture: `clips/<clipName>.webp`, and if that fails to load, `clips/<clipName>.mp4`. An explicit `clip` always wins (no fallback). Pause steps never get implicit clips.
- View-model: implicit clip media = `{ src: 'clips/<n>.webp', kind: 'image', fallback: { src: 'clips/<n>.mp4', kind: 'video' } }`; explicit clips unchanged (no `fallback`). `app.js renderMedia`: on image error with a fallback, try the fallback video; on its error hide (no broken element, no retry loop).
- `sw.js precacheRoutines`: for exercise steps without `clip`, best-effort fetch of both convention paths (404 ignored, not cached).
- Existing routines keep their explicit clips (no routine file changes); KB 60 totals unchanged.
AC:
- Routine tests for `clipName`: the examples above plus `Two-hand swing`, `  Farmer  carry `, `Halo`.
- View tests: next exercise without clip → webp media with mp4 fallback; explicit clip → no fallback; get-ready → step 1's media; exercise steps → null (unchanged).
- SW test (vm sandbox): precache requests both convention paths for a step without `clip` and does not fail when they 404.
- Self-audit: in the browser, a step named like an existing clip but without `clip` shows the picture; an unknown name shows nothing and no repeated errors.

### T26 — Owner: import a routine from a table
Status: done
- User change 4 (D44). SPEC §4b, §4c (table format).
- New pure UMD module `js/import.js` (global `Import`; in `index.html` + `APP_SHELL`):
  - `COLUMNS` = the SPEC §4c column list; `CHAT_PROMPT` = the Claude Chat prompt text from SPEC §4c (lists the same columns).
  - `parseTable(text)` → `{ header[], rows[][], errors[], warnings[] }`. Accepts a Markdown pipe table (separator row ignored, outer pipes optional) or tab-separated text (copied from a chat or spreadsheet); text before/after the table is ignored. Header matched case-insensitively, extra spaces ignored; unknown columns → warning; missing required column → error.
  - `toRoutine(parsed, { name, weight })` → `{ routine, errors[], warnings[] }` per SPEC §4c rules, `id` = `Routine.clipName(name)`, then `Routine.validateRoutine`. Every table error names the data row (1 = first data row) and column, e.g. `row 4, Reps: expected whole number`.
  - `fileName(id, existingFiles)` → `<id>.json`, or `<id>-2.json`, `-3`… if taken.
- Picker in owner mode: "Import routine" button → panel `#import-panel`: Name (required), Weight (optional), a large textarea for the table, "Copy prompt for Claude Chat" (copies `CHAT_PROMPT`; if clipboard fails, shows it selectable), "Check". Check shows errors, or a preview (blocks with rounds, steps with target, total via `Routine.totalDuration`) plus a picture list: each distinct exercise with its expected file `clips/<clipName>.webp` / `.mp4` and ✓ found / ✗ missing (load test with an `Image`/`video` element; "?" when it cannot be checked). "Add" (enabled only when valid) stores it as a draft-only routine via `Drafts` (T24) and closes the panel; the card appears with "unpublished".
- Enter/Space inside the panel never start a routine (T23 guard).
AC:
- `tests/import.test.js`: Markdown and TSV versions of the same table give the same routine; the SPEC §4c example table validates and its `totalDuration` and step count match a hand-computed value; a table equivalent to `routines/demo.json` (minus clips) gives the same `totalDuration`; block grouping with blank Block cells; pause/rest; per-side values; errors carry row + column (bad reps, both reps and seconds, missing cues for an exercise, unknown type, missing required column); `fileName` collisions; every `COLUMNS` entry appears in `CHAT_PROMPT`.
- Static UI test: import panel IDs used by `app.js` exist; `js/import.js` in `index.html` + `APP_SHELL`.
- Self-audit: paste the SPEC §4c example on phone portrait and at 1280×720 → Check shows preview + total; Add → new card with unpublished tag; it starts and runs.

### T27 — Owner: publish changes + docs
Status: todo
- User change 4 (D45). SPEC §4b, README.
- `Drafts.publishFiles(entries, drafts)` (pure) → `[{ file, text }]`: one file per new or renamed routine (`JSON.stringify(routine, null, 2)` + newline) and `index.json` = published order minus removed files, plus new files appended (`{ "routines": [...] }`, 2-space indent).
- Picker in owner mode, when drafts are not empty: "Publish (N changes)" → panel `#publish-panel` listing each file with a "Download" button (Blob + `<a download>`), the steps ("Upload all files to the `routines/` folder on github.com → Commit changes. Everyone sees it next time they open the app.") and "Mark as published" (clears drafts after a confirm). No network calls.
- Docs: README "Add a routine" rewritten for the owner flow (Claude Chat prompt → Import → Publish → upload on GitHub; manual JSON route kept short); new "Exercise pictures" section (naming rule from SPEC §3 with examples, upload to `clips/`); new "Owner PIN" section (`node tools/set-pin.js`, commit + push; PIN only hides controls). New `docs/ROUTINE-PROMPT.md` = the Claude Chat prompt (same text as `Import.CHAT_PROMPT`).
AC:
- `tests/drafts.test.js`: publish files for rename-only, remove-only, new-only and mixed drafts; `index.json` order rule; every routine file text parses and validates with `Routine.validateRoutine`; file names are lowercase-kebab `.json`.
- `tests/docs.test.js`: `docs/ROUTINE-PROMPT.md` contains `Import.CHAT_PROMPT` verbatim.
- Static UI test: publish panel IDs exist.
- Self-audit: download the files in Chrome and show the `index.json` content for a mixed draft.

### T28 — Release v10
Status: todo
- Bump `CACHE_VERSION` in `sw.js` and `version` in `js/app-info.js` to `v10`; CHANGELOG `## Unreleased` → `## v10 (date)` with a fresh empty `## Unreleased` above.
AC:
- Release tests pass with `v10`.
