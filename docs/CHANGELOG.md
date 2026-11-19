# CHANGELOG

Format: one line per task under `## Unreleased`: `- Txx: summary`. On release, rename to `## vN (date)` and bump `CACHE_VERSION` in `sw.js` to `vN`.

## Unreleased
- T12: tests/release.test.js (CACHE_VERSION == top CHANGELOG version) + README.md.
- T13: routines/kb-60-core-full-body.json (3531 s, 78 steps) registered in index.json + registry test.
- T14: contrast test (>= 7:1 tokens, size tokens), E2E KB 60 simulation test, portrait CSS scaling for long names/cues.
- T15: rest/get-ready countdown has no target (view-model `nextTarget` feeds the enlarged "Next:" line); Next line 7vh, status 4.5vh, NEXT UP 5vh.
- T16: end screen total time uses `View.formatTotal` (m:ss / h:mm:ss).
- Backlog: T15–T17 added from browser check (rest-screen target, secondary text sizes, total-time format, cleanup + v2 release); SPEC §4/§6 sizes updated.

## v1 (2026-11-19)
- Setup: CLAUDE.md, docs (SPEC, BACKLOG, DECISIONS, QUESTIONS), run_loop.ps1, test harness.
- Setup: SPEC v2 — fully automatic timed steps (reps × secPerRep), blocks with rounds, tap-first controls; KB 60 routine draft (Q01).
- T01: App shell (index.html, css/app.css tokens, js/app-info.js) + smoke tests.
- T02: js/routine.js — validateRoutine, stepDuration, expand, totalDuration (schema v2) + tests.
- T03: routines/index.json + routines/demo.json + registry test (all routine files valid and listed).
- T04: js/engine.js — pure timer state machine (ready, auto-advance, pause, skip, back, beep/final-beep/finished events) + fake-clock tests.
- T05: js/keys.js — pure mapKey(key, screen) per SPEC §5 + tests.
- T06: js/view.js — pure toView(engineState) view-model (cues/target/countdown/blockLabel/nextUp/theme/paused) + tests.
- T07: js/app.js UI wiring (picker cards, run screen, tap bottom bar, PAUSED overlay, end screen, keyboard via keys.js) + CSS + static UI test.
- T08: audio.js with createBeeper (unlock, beep, finalBeep, onEvent), wired to engine events in app.js, with mock-AudioContext tests.
- T09: js/screen.js (fullscreen on Start; wake lock acquire/release/re-acquire on visibilitychange) wired in app.js + mock tests.
- T10: Optional exercise clips (muted looping video for current/next step; hidden if missing/failed).
- T10 review fixes: view-model test that an exercise uses its own clip, not the next step's.
- T11: manifest.webmanifest, generated icons (tools/make-icons.js), sw.js (APP_SHELL + runtime routine/clip precache, cache-first, old-cache cleanup, skipWaiting/clients.claim), SW registered in app.js, tests/pwa.test.js.
