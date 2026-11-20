# Kettlebell Workout Timer

Offline phone PWA (mirrored to a TV) that runs timed kettlebell routines automatically. Plain HTML/CSS/JS, no build, no dependencies. See `docs/SPEC.md`.

## Run locally
Any static server works (service workers need `http://localhost` or HTTPS):
```
python -m http.server 8000
```
Open http://localhost:8000. Run tests: `node --test "tests/*.test.js"`.

## Deploy on GitHub Pages
1. Push to `main`.
2. Repo Settings → Pages → Source: "Deploy from a branch", Branch `main`, folder `/ (root)`.
3. Open the published URL once online; afterwards the app works offline.

## Add a routine
1. Create `routines/<id>.json` (lowercase-kebab name; schema in `docs/SPEC.md` §3).
2. Add the file name to the list in `routines/index.json`.
3. Optional clips: put files at the clip paths the routine references (relative, no `..`).

No code change needed. A test checks every routine file is valid and listed.

## Release
Move CHANGELOG `Unreleased` to `## vN (date)` and set `CACHE_VERSION = "vN"` in `sw.js` so phones pick up the update. `tests/release.test.js` fails if they differ.

## Development workflow
Features and fixes are built by Claude sessions driven by `run_loop.ps1`; session rules are in `CLAUDE.md`.

1. **Request a change**: append a task to `docs/BACKLOG.md`:
   ```
   ### T18 — Short title
   Status: todo
   - What to change (and why, if found by testing).
   AC:
   - Testable acceptance criteria (prefer ones a Node test can check).
   ```
   If the change alters behavior, update `docs/SPEC.md` too, so the reviewer can check against it. Commit.
2. **Run the loop** (needs a clean working tree):
   ```
   powershell -ExecutionPolicy Bypass -File .\run_loop.ps1            # all todo tasks
   powershell -ExecutionPolicy Bypass -File .\run_loop.ps1 -MaxTasks 1
   ```
   Per task: Sonnet implements and commits → script runs tests → Opus reviews → pushed on APPROVE.
   It stops on failing tests, a second REJECT, or a new open question in `docs/QUESTIONS.md`
   (answer it, set `Status: answered`, set the task back to `todo`, rerun). Logs: `logs/`.
3. **Check in a real browser** — sessions never open the app, so after every run:
   - Run locally (see above) at TV size (1280×720 or 1920×1080) and phone portrait: text fits, nothing overlaps the control bar, rest screens show the next exercise.
   - Start a routine with one tap: it runs on its own; Pause/Skip/Back work by tap and arrow keys.
   - After a release, on the phone via the Pages URL: open once, then airplane mode + reload (offline), 3-2-1 beeps audible, screen stays awake.
   - Anything wrong → add a new backlog task (step 1).
4. **Release** when a batch is verified (see Release above).
