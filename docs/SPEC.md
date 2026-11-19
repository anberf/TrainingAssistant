# SPEC — Kettlebell TV Timer

## 1. Product
Offline kettlebell workout timer. Runs on a phone (PWA) and is mirrored/cast to a TV, or opened directly in a TV/desktop browser. Fully auto-runs a routine: after Start, no step ever waits for input. Readable from 3 m.

## 2. Platform & constraints
- Single page: `index.html` + `css/`, `js/`, `routines/`, `clips/`, `icons/`, `manifest.webmanifest`, `sw.js`.
- Plain JS/CSS. No frameworks, no CDN, no internet at runtime, no build step, no runtime deps.
- Served over HTTP(S) (GitHub Pages; locally any static server). `file://` is NOT supported — D03.
- Works fully offline after first load (service worker, §7).
- Targets: Android Chrome (primary, touch), desktop Chrome/Edge, TV browsers (best effort).

## 3. Routines (data)
- Location: `routines/<id>.json`. Registry: `routines/index.json` = `{"routines": ["<id>.json", ...]}`.
- Adding a routine = add JSON file + one line in `index.json`. No code change.
- Authored as **blocks with rounds**; the app expands them to a flat step list at load (D10).
- Schema (v2):
```json
{
  "id": "kb-example",
  "name": "Example",
  "description": "optional",
  "weight": "10 kg",
  "defaults": { "secPerRep": 3 },
  "blocks": [
    {
      "name": "Block A",
      "rounds": 3,
      "restBetweenRounds": 120,
      "steps": [
        { "name": "Two-hand swing", "type": "exercise", "reps": 15,
          "cues": ["Hips back, not down", "Snap hips to stand", "Arms are ropes"] },
        { "name": "Pause", "type": "pause", "seconds": 20 },
        { "name": "Turkish get-up", "type": "exercise", "reps": 3, "perSide": true, "secPerRep": 20,
          "cues": ["Eyes on the bell", "Arm locked overhead", "Slow and controlled"] },
        { "name": "Suitcase march", "type": "exercise", "seconds": 30, "perSide": true,
          "cues": ["Stand tall, no lean", "Knees to hip height", "Brace your core"] }
      ]
    }
  ]
}
```
- Block rules: `name` non-empty; `rounds` int ≥ 1 (default 1); `restBetweenRounds` int ≥ 0 seconds (default 0) — inserted between rounds, never after the last round; `steps` non-empty.
- Step rules:
  - `name`: non-empty string (≤ 40 chars recommended).
  - `type`: `"exercise"` | `"pause"`.
  - Exactly one of `reps` (int ≥ 1) or `seconds` (int ≥ 1). `pause` must use `seconds`.
  - `secPerRep` (optional, number > 0): overrides `defaults.secPerRep`; global default 3.
  - `perSide` (optional bool): work is done on both sides → duration × 2; display adds "/ side".
  - `cues`: exercise → exactly 3 non-empty strings, each ≤ 30 chars. Pause → cues optional (a pause shows the NEXT exercise's cues).
  - `clip` (optional): relative local path (no `http(s):`, no `//`, no `..`).
  - Unknown fields → warning, not error.
- **Duration** (seconds) of every step:
  - reps step: `reps × secPerRep × (perSide ? 2 : 1)`
  - seconds step: `seconds × (perSide ? 2 : 1)`
- **Expansion** (`expand(routine) -> steps[]`): for each block, for each round r: the block steps, then (if r < rounds and restBetweenRounds > 0) a generated pause step `"Rest"` of that length. Each flat step carries `{ name, type, durationSec, reps?, perSide, cues, clip?, block, round, rounds }`.
- Invalid routines are shown in the picker as disabled with the first error; they never crash the app.

## 4. Run behavior (fully automatic)
- **Picker screen**: list of routines (name, weight, total duration from expansion). Tap a routine (or arrows + Enter) = **Start**. Start also enters fullscreen, acquires wake lock, unlocks audio.
- **Get-ready**: 5 s countdown before step 1 (shows step 1 as "next up" with its cues).
- **Every step is timed** and auto-advances at 0. Nothing waits for input (D04 superseded by D11).
- **Display during a step**: step name, type badge (EXERCISE / REST), big countdown `m:ss`/`ss`, for reps steps a target label `×10` or `×10 / side` next to the countdown, block name + `round r/n`, step index `n / total`, "NEXT UP: <name>".
- **Cues**: current exercise shows its 3 cues; during a pause the screen prominently shows the NEXT exercise's name, target, and its 3 cues (+ clip if any).
- **Beeps** (WebAudio, generated tones, no audio files): short beep at 3, 2, 1 s remaining of every step; distinct longer/higher tone at 0. No beeps while paused.
- **Paused**: countdown frozen, large "PAUSED" overlay.
- **End screen**: "Done" + total elapsed time + one button "Back to routines".

## 5. Controls
The ONLY user controls: **Start** (once, picker), **Pause/Resume**, **Skip**, **Back**.
- **Primary = on-screen tap buttons** (phone): bottom bar with 3 large buttons `◀ Back` · `⏯ Pause/Resume` · `▶ Skip`; each ≥ 12vh tall and ≥ 25vw wide, high contrast, always visible during a run (also on TV mirror). Tapping anywhere else does nothing.
- **Secondary = keyboard / TV remote**:

| Key | Picker | Running / paused |
|---|---|---|
| Enter / OK / Space / MediaPlayPause | Start selected routine | Pause/Resume |
| → ArrowRight / MediaTrackNext | next item | Skip |
| ← ArrowLeft / MediaTrackPrevious | previous item | Back |
| ↑ / ↓ | move selection | — |
| anything else | — | ignored |
- **Back** rule: if > 3 s elapsed in current step → restart it; else go to previous step (D07). Back/Skip work while paused and keep the paused state.
- Key handling via a pure mapping function (`key`, `screen` → action), testable in Node.

## 6. TV mode / display
- Fullscreen entered on Start (Fullscreen API); silently skipped if unsupported.
- Landscape layout (16:9) primary; portrait phone layout must still be usable.
- High contrast: near-black background, white text, one accent color per step type (exercise vs rest); main text contrast ≥ 7:1.
- Sizes in viewport units: countdown ≥ 30vh tall; step name ≥ 8vh; cues ≥ 5vh. Readable at 3 m on a 40" TV. Long names/cues must not overflow (shrink or ellipsis).
- Screen Wake Lock while a routine runs; re-acquire on `visibilitychange`; silently degrade if unsupported.
- Optional clip: `<video muted loop playsinline autoplay>` from local path; missing/failed clip → hide video, no error.

## 7. PWA, offline, release
- `manifest.webmanifest`: name, short_name, `display: fullscreen`, `orientation: landscape`, dark theme colors, local icons (192, 512, maskable).
- `sw.js`: `const CACHE_VERSION = "vN"`; on install precache app shell + `routines/index.json` + every routine listed + their clips; cache-first fetch; on activate delete old caches; skipWaiting + clientsClaim so phones auto-update on next open.
- Release = bump `CACHE_VERSION` + move CHANGELOG `Unreleased` to a version heading.
- Deploy: GitHub Pages from `main` (root). `run_loop.ps1` pushes after each approved task.

## 8. Quality
- Pure modules tested with `node --test "tests/*.test.js"`: routine validation + expansion + durations, engine (timing, pause, skip, back, beep events, auto-advance), key mapping, view-model, SW precache completeness, every routine valid and registered.
- Timing uses wall-clock deltas (`performance.now()`), not interval counting; drift ≤ 100 ms per step.
