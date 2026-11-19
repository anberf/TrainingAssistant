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
