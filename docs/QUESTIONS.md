# QUESTIONS

Sessions append here when blocked, then stop. Humans answer inline and set `Status: answered`.
`run_loop.ps1` counts lines matching `Status: open`; an increase during a run stops the loop.

Template:
```
## Q## — short title (task Txx, date)
Status: <open|answered>
Context: 1–3 lines.
Question: one clear question.
Options: A) ... B) ...  (recommended first)
Answer:
```

## Q01 — First routine table missing (task T13, 2026-11-19)
Status: answered
Context: Setup request referenced a routine table that was not included.
Question: Paste the routine table.
Answer: "KB 60 min core + full body" (10 kg). Encoded in `docs/routine-drafts/kb-60-core-full-body.json`; schema changes in D10–D14. T13 set to todo.
