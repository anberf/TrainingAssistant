# SPEC — Training Assistant

## 1. Product
Offline kettlebell workout timer. Runs on a phone (PWA) and is mirrored/cast to a TV, or opened directly in a TV/desktop browser. Fully auto-runs a routine: after Start, no step ever waits for input. Readable from 3 m.

## 2. Platform & constraints
- Single page: `index.html` + `css/`, `js/`, `routines/`, `clips/` (exercise pictures/videos), `icons/`, `manifest.webmanifest`, `sw.js`.
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
  - `clip` (optional): relative local path (no `http(s):`, no `//`, no `..`) to a video (`.mp4`, `.webm`) or image (`.svg`, `.gif`, `.webp`, `.png`, `.jpg`, `.jpeg`); other extensions are errors. Default pictures: user-made exercise clips as animated WebP `clips/<exercise-kebab>.webp` (480×270) or, when a WebP would be too large, MP4 video `clips/<exercise-kebab>.mp4` (H.264, no audio); ≤ 512 KB each (D33, D34, D36).
  - Picture naming rule (D43): an exercise step without `clip` uses `clips/<clip-name>.webp`, falling back to `clips/<clip-name>.mp4`; clip-name = exercise name lowercased, every run of non `a–z0–9` characters → `-`, trimmed (`Goblet reverse lunge` → `goblet-reverse-lunge`, `Leg & hip stretch` → `leg-hip-stretch`). Missing file → no picture. An explicit `clip` always wins.
  - Unknown fields → warning, not error.
- **Duration** (seconds) of every step:
  - reps step: `reps × secPerRep × (perSide ? 2 : 1)`, where effective `secPerRep` = pace exercise override (by step name) > step `secPerRep` > pace `secPerRep` > `defaults.secPerRep` > 3 (pace: §4a).
  - seconds step: `seconds × (perSide ? 2 : 1)`
- **Expansion** (`expand(routine) -> steps[]`): for each block, for each round r: the block steps, then (if r < rounds and restBetweenRounds > 0) a generated pause step `"Rest"` of that length. Each flat step carries `{ name, type, durationSec, reps?, perSide, cues, clip?, block, round, rounds }`.
- Invalid routines are shown in the picker as disabled with the first error; they never crash the app.

## 4. Run behavior (fully automatic)
- **Picker screen**: list of routines (name, weight, total duration from expansion). Tap a routine (or arrows + Enter) = **Start**. Start also enters fullscreen, acquires wake lock, unlocks audio.
- **Get-ready**: 5 s countdown before step 1 (shows step 1 as "next up" with its cues).
- **Every step is timed** and auto-advances at 0. Nothing waits for input (D04 superseded by D11).
- **Display during a step**: step name, type badge (EXERCISE / REST), big countdown `m:ss`/`ss`, for reps exercise steps a target label `×10` or `×10 / side` next to the countdown (never next to a rest/get-ready countdown — there the target appears only in the "Next:" line), block name + `round r/n`, step index `n / total`, "NEXT UP: <name>".
- **Cues**: current exercise shows its 3 cues; during a pause the screen prominently shows the NEXT exercise's name, target, and its 3 cues.
- **Picture**: during rest and get-ready, the NEXT exercise's `clip` (image or video) appears beside the big countdown (landscape: countdown left, picture right). No picture during exercise steps. Missing/failed clip → nothing shown (D31).
- **Beeps** (WebAudio, generated tones, no audio files): short beep at 3, 2, 1 s remaining of every step; distinct longer/higher tone at 0. No beeps while paused.
- **Paused**: countdown frozen, large "PAUSED" overlay.
- **End screen**: "Done" + total elapsed time as `m:ss` (or `h:mm:ss` ≥ 1 h) + one button "Back to routines".

## 4a. Pace settings (picker)
- "Pace" panel at the top of the picker; tap controls only (no new keys).
- Row "Seconds per rep": `−` value `+`. Value `routine` (= each routine's `defaults.secPerRep`, the initial state) or 1–6 s in 0.5 s steps; `+` from `routine` → 3.5, `−` from `routine` → 2.5.
- One row per distinct exercise name that has its own step `secPerRep` in any valid routine (e.g. Turkish get-up 20 s): `−` value `+`, 1–60 s; step 0.5 s below 10 s, 5 s from 10 s up. Initial value = that step's `secPerRep`.
- "Reset" restores all rows to the routine values.
- Card durations update live; a run uses the pace in effect at Start. Saved in `localStorage` key `kb-timer-pace` = `{ "secPerRep": number|null, "exercises": { "<name>": number } }`; invalid/unavailable storage → routine values, never an error.

## 4b. Owner mode (picker; routine editing)
- Purpose: only the owner edits the shared routines; everyone else only runs them and sets their own pace (§4a, per device). Shared routines = the files in the GitHub repo; only the owner can push (the real protection). Owner mode only hides controls (D40).
- Unlock: "Owner" button below the version → PIN field → owner mode on this device (localStorage `kb-timer-owner` = PIN hash). PIN hash lives in `js/owner-config.js` (set with `node tools/set-pin.js`). Empty hash = cannot unlock. "Lock" turns it off (D41).
- Owner controls (tap only; hidden when owner mode is off): per card "Rename" (display `name` only; file name and `id` stay) and "Remove" (+ "Undo"); "Import routine" (§4c); "Publish (N changes)".
- Every change is an unpublished draft on the owner's device (localStorage `kb-timer-drafts`), visible only there, cards tagged "unpublished" (D42).
- Publish = download the changed routine files + updated `routines/index.json`; the owner uploads them to `routines/` on github.com and commits. Others see the change the next time they open the app online (§7). "Mark as published" clears the drafts (D45).
- Typing in any owner input never triggers picker keys (Enter/Space/arrows).

## 4c. Import table format
- Paste a Markdown pipe table or tab-separated text. Header row required; header names case-insensitive. Columns (in any order):
  `Block | Rounds | Rest between rounds | Exercise | Type | Reps | Seconds | Per side | Sec per rep | Cue 1 | Cue 2 | Cue 3`. All required except `Sec per rep`.
- One row per step, in order. `Block` filled on the first row of each block (blank = same block); `Rounds` (default 1) and `Rest between rounds` (seconds, default 0) read from the block's first row.
- `Type`: `exercise` or `pause` (`rest` = pause). Exactly one of `Reps` / `Seconds` (whole numbers ≥ 1); pauses use `Seconds`. `Per side`: `yes`/`y`/`true`/`x` or blank/`no`. `Sec per rep`: optional number > 0 (e.g. Turkish get-up 20). `Cue 1–3`: exercises need all 3 (≤ 30 chars each); pauses leave them blank.
- Routine `name` and `weight` are typed in the import panel; `id` = name in clip-name form (§3); `defaults.secPerRep` = 3. Pictures come from the naming rule (§3).
- Example (total 570 s, 13 steps):

| Block | Rounds | Rest between rounds | Exercise | Type | Reps | Seconds | Per side | Sec per rep | Cue 1 | Cue 2 | Cue 3 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Warm-up | 1 | 0 | Halo | exercise | 10 | | yes | | Bell close around head | Ribs down, glutes tight | Slow, smooth circles |
| | | | Pause | pause | | 15 | | | | | |
| Main | 3 | 60 | Two-hand swing | exercise | 15 | | | | Hinge, don't squat | Snap hips to stand | Arms are ropes |
| | | | Pause | pause | | 20 | | | | | |
| | | | Suitcase march | exercise | | 30 | yes | | Stand tall, no lean | Knees to hip height | Brace your core |

- Claude Chat prompt (`Import.CHAT_PROMPT`, also `docs/ROUTINE-PROMPT.md`), to paste with the workout idea:
  > Write my workout as ONE Markdown table with exactly these columns: Block | Rounds | Rest between rounds | Exercise | Type | Reps | Seconds | Per side | Sec per rep | Cue 1 | Cue 2 | Cue 3. One row per step, in order. Fill Block, Rounds and Rest between rounds (seconds) only on the first row of each block. Type is "exercise" or "pause". Use either Reps or Seconds (whole numbers), never both; pauses use Seconds. Per side is "yes" when the exercise is done on each side, else blank. Sec per rep only for slow exercises (e.g. Turkish get-up 20). Every exercise needs 3 short cues of at most 30 characters; pauses have no cues. Use the same exercise names every time. Output only the table.

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
- Sizes in viewport units: countdown ≥ 30vh tall; step name ≥ 8vh; cues ≥ 5vh; "Next:" line during rest/get-ready ≥ 7vh; status line (badge, block/round, index) ≥ 4.5vh; "NEXT UP" ≥ 5vh. Readable at 3 m on a 40" TV. Long names/cues must not overflow (shrink or ellipsis).
- Screen Wake Lock while a routine runs; re-acquire on `visibilitychange`; silently degrade if unsupported.
- Optional clip beside the rest/get-ready countdown: `<img>` for images, `<video muted loop playsinline autoplay>` for videos; height ≥ 25vh in landscape; missing/failed clip → hidden, no error.

## 7. PWA, offline, release
- `manifest.webmanifest`: name, short_name, `display: fullscreen`, `orientation: landscape`, dark theme colors, local icons (192, 512, maskable).
- `sw.js`: `const CACHE_VERSION = "vN"`; on install precache app shell + `routines/index.json` + every routine listed + their clips (incl. naming-rule paths, best effort); fetch: `routines/*` network-first (cache fallback offline) so published routine changes reach every device without a release (D39), everything else cache-first; on activate delete old caches; skipWaiting + clientsClaim so phones auto-update on next open.
- Release = bump `CACHE_VERSION` and `AppInfo.version` (`js/app-info.js`, same `vN`) + move CHANGELOG `Unreleased` to a version heading.
- The picker shows `Version vN` (from `AppInfo.version`) below the routine list (D35).
- Deploy: GitHub Pages from `main` (root). `run_loop.ps1` pushes after each approved task.

## 8. Quality
- Pure modules tested with `node --test "tests/*.test.js"`: routine validation + expansion + durations, engine (timing, pause, skip, back, beep events, auto-advance), key mapping, view-model, SW precache completeness, every routine valid and registered.
- Timing uses wall-clock deltas (`performance.now()`), not interval counting; drift ≤ 100 ms per step.
