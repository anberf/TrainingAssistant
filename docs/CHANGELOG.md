# CHANGELOG

Format: one line per task under `## Unreleased`: `- Txx: summary`. On release, rename to `## vN (date)` and bump `CACHE_VERSION` in `sw.js` to `vN`.

## Unreleased
- Setup: CLAUDE.md, docs (SPEC, BACKLOG, DECISIONS, QUESTIONS), run_loop.ps1, test harness.
- Setup: SPEC v2 — fully automatic timed steps (reps × secPerRep), blocks with rounds, tap-first controls; KB 60 routine draft (Q01).
- T01: App shell (index.html, css/app.css tokens, js/app-info.js) + smoke tests.
- T02: js/routine.js — validateRoutine, stepDuration, expand, totalDuration (schema v2) + tests.
