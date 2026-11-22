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

## Add a routine (owner flow)
1. In Claude Chat, paste the prompt from `docs/ROUTINE-PROMPT.md` plus your workout idea. You get one table.
2. In the app: Owner (PIN) → **Import routine** → type the name (and weight), paste the table → **Check** (errors name the row and column; a preview shows the total time and which pictures exist) → **Add**. The routine shows as "unpublished" on your device only.
3. **Publish (N changes)** → **Download** every listed file (the new/changed routine files and `index.json`).
4. On github.com open the `routines/` folder → Add file → Upload files → drop all downloaded files → Commit changes. Everyone sees it the next time they open the app online.
5. Back in the app: **Mark as published** (clears your drafts).

Rename and Remove (with Undo) work the same way: they are drafts until published.

Manual route: create `routines/<id>.json` (lowercase-kebab; schema in `docs/SPEC.md` §3) and add its file name to `routines/index.json`. No code change needed. A test checks every routine file is valid and listed.

## Exercise pictures
An exercise without `clip` uses `clips/<clip-name>.webp`, or `clips/<clip-name>.mp4` if there is no WebP. clip-name = exercise name in lowercase, every run of characters other than a–z and 0–9 replaced by `-`, no `-` at the ends:
- `Two-hand swing` → `clips/two-hand-swing.webp`
- `Leg & hip stretch` → `clips/leg-hip-stretch.webp`
- `Halo` → `clips/halo.webp`

Upload the file to `clips/` on github.com (animated WebP 480×270 ≤ 512 KB, or H.264 MP4 without audio). No JSON change needed; a missing file just shows no picture. The import preview lists the expected file names with found / missing. An explicit `clip` in the routine always wins.

## Owner PIN
Owner mode (rename, remove, import, publish) is unlocked by a PIN. Set it once on your computer:
```
node tools/set-pin.js
```
Enter the PIN (4–12 digits) twice; it writes only a hash to `js/owner-config.js`. Commit and push, then do a release so phones get the new file. The PIN only hides the controls; the real protection is that only you can push to GitHub.

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
