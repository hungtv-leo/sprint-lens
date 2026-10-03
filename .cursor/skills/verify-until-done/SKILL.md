---
name: verify-until-done
description: >
  Run implement → verify → fix in the same session until the task meets
  Definition of done and verify commands PASS. Use when the user assigns
  coding work, asks to finish, self-test, build/lint, or mentions
  verify-until-done / automated harness loops.
---

# Verify until Done

The agent does **not** stop after editing files. In the same session: change → run verify → on fail fix → loop until PASS or the limit.

## Algorithm

```
0. (baseline) Know verify status BEFORE edits: which failures/warnings already exist?
loop (max N, default 8 — or the number in AGENTS.md):
  1. Implement the minimal remaining change
  2. Pick verify commands from AGENTS.md for paths touched
     - If AGENTS.md has tiers → use the FAST gate inside the loop
  3. Run commands for real (Shell) — do not guess results
  4. On FAIL:
       - Caused by YOUR change → read stderr → fix → continue loop
       - ENVIRONMENT (missing venv/deps/DB) or PRE-EXISTING baseline
         → do NOT burn a loop; tell the user in one line; treat gate as "n/a"
  5. On PASS: if work remains → continue; if you believe Done → run FULL gate
       (build / import app). Red → back to loop. Green → check DoD → report Done
after N loops still FAIL (from your changes):
  Stop. Summarize errors + attempts. Ask the user. Do not say "Done".
```

## Hard rules

- Read `AGENTS.md` (root or nested) before choosing verify commands
- Do not claim Done while verify is red
- Do not skip verify for a “small” change if AGENTS.md requires it
- No infinite sleep-loops; purposeful fix loops only
- AGENTS.md hard stops win (secrets, force-push, …)

## When the repo has no tests

Use the proxy gates listed in AGENTS.md: lint, build, compileall, import app, health curl.

## Real failure vs noise

- **Environment:** `ModuleNotFoundError`, missing `.venv`, no DB → one-time setup or minimal gate; do not burn loops
- **Baseline:** lint/type noise in files you did **not** touch → out of scope; mention only
- **Real:** errors in files you changed, or a gate that flipped green → red → must fix

## Done report

1–3 sentences: scope · verify commands · PASS. No essay.
