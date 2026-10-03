---
name: ship-change
description: >
  Take a feature, hotfix, or bugfix and run it end-to-end in one session:
  classify → clarify minimal scope → implement → verify-until-done → report Done.
  Use when the user assigns a feature, hotfix, bug, “ship it”, “làm giúp”,
  or wants the agent to finish the whole change.
---

# Ship change (feature / hotfix)

Goal: from **one assignment message** → code + verify PASS + Done report, **without** waiting for step-by-step nudges.  
Commit / push / PR **only** when the user explicitly asks.

Read `AGENTS.md` first. Use skill `verify-until-done` for the verify loop.

## 0. Classify once (silently)

| Kind | Signals | Approach |
|------|---------|----------|
| **hotfix** | production/urgent, regression, “fix now”, clear bug | Narrowest fix; no refactor; verify immediately |
| **bugfix** | wrong behavior, not urgent | Find root cause → fix → verify |
| **feature** | new capability, screen/API | Clear scope → thin vertical slice → verify |

If **one** blocking detail is missing (which screen / API / expected) → ask **at most 1–2 questions**, then continue. If the codebase supports a reasonable guess → **do not ask**; note assumptions at Done.

## 1. Quick survey

- Hotfix/bug: explore by symptom / related symbols
- Feature: explore the nearest existing CRUD/page/API pattern — match the repo; do not invent a new stack

## 2. Execute (do not stop midway)

1. Implement within scope (hotfix = tiny diff)
2. Run **Verify commands** from `AGENTS.md` for paths touched
3. Fail → fix → verify again (max 8 loops)
4. PASS + DoD → report Done

**Forbidden:** stop after only writing code; ask “want me to run lint?”; skip verify.

## 3. Done report (short)

```
Kind: hotfix | bugfix | feature
Done: …
Verify: [commands] → PASS
Assumptions (if any): …
Not done (out of scope): commit/PR/deploy unless requested
```

## Boundary of “end-to-end”

**In session (do it):** understand → edit → lint/build/import → loop to green → summarize.  
**Out of session (only if user asks):** commit, push, open PR, merge, deploy, production Docker.

Large multi-module features: state a 3–6 step plan **then implement in the same chat** unless the user is in Plan mode or said “plan only”.
