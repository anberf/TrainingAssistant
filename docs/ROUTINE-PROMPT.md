# Claude Chat prompt for new routines

Paste this into Claude Chat together with your workout idea, then paste the resulting table into the app (Owner → Import routine). Same text as `Import.CHAT_PROMPT` and SPEC §4c.

Write my workout as ONE Markdown table with exactly these columns: Block | Rounds | Rest between rounds | Exercise | Type | Reps | Seconds | Per side | Sec per rep | Cue 1 | Cue 2 | Cue 3. One row per step, in order. Fill Block, Rounds and Rest between rounds (seconds) only on the first row of each block. Type is "exercise" or "pause". Use either Reps or Seconds (whole numbers), never both; pauses use Seconds. Per side is "yes" when the exercise is done on each side, else blank. Sec per rep only for slow exercises (e.g. Turkish get-up 20). Every exercise needs 3 short cues of at most 30 characters; pauses have no cues. Use the same exercise names every time. Output only the table.
