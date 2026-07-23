---
name: kpi-developer
description: >-
  Computes Developer KPI rates from Jira issues (commitment, schedule, throughput)
  and maps them onto the KPI Developer Demo Excel sheet. Use when calculating or
  exporting Developer KPI for sprint or month periods.
---

# KPI Developer

Agent-agnostic skill for Sprint Lens. Load this skill when the role is `developer`.

## When to use

- User exports or calculates Developer KPI
- Need completed vs incomplete task stats for a sprint or calendar month
- Need to fill sheet `KPI Developer Demo` in the KPI template

## Inputs

Expect JSON:

```json
{
  "role": "developer",
  "period": { "type": "sprint|month", "sprint": "active|id", "month": "YYYY-MM" },
  "assignee": "Display Name",
  "projects": ["PROJ"],
  "issues": [
    {
      "key": "PROJ-1",
      "summary": "...",
      "status_category": "done|indeterminate|new",
      "status_name": "...",
      "due_date": "YYYY-MM-DD|null",
      "updated": "ISO-8601|null",
      "story_points": null
    }
  ]
}
```

## Definitions

- **Committed**: all issues in the dataset except cancelled (status name contains `cancel` / `hủy` / `won't` / `withdrawn`).
- **Completed**: committed issues with `status_category == "done"`.
- **Incomplete**: committed − completed.
- **Commitment Achievement rate** = `completed / committed` (0 if committed = 0).
- **On-time completed**: completed issues that have `due_date` and whose completion date (`updated` date when done) is on or before `due_date`. Issues without `due_date` are excluded from the on-time denominator.
- **Schedule Performance rate** = `on_time_completed / on_time_eligible` where `on_time_eligible` = completed issues that have `due_date`. If none eligible → rate `null`, cell J6 = `"x"`.
- **Work Throughput**: template forbids raw ticket counts. If any issue has numeric `story_points`, rate = `sum(points of completed) / sum(points of committed)`. Otherwise J7 = `"x"`.

## Score tables (column K)

Commitment / Schedule / Throughput (% → score /10):

| Rate | Score |
|------|-------|
| ≥ 1.00 | 10 |
| ≥ 0.95 | 9.5 |
| ≥ 0.90 | 9.0 |
| ≥ 0.80 | 8.0 |
| < 0.80 | 6.0 |

Schedule uses the same bands when rate is available. Throughput same bands when computable.

## Excel mapping — sheet `KPI Developer Demo`

| Metric | Cell J | Cell K |
|--------|--------|--------|
| Commitment Achievement | J5 | K5 |
| Schedule Performance | J6 | K6 |
| Work Throughput | J7 | K7 |
| Delivery Ownership | leave `x` | leave as-is |
| Quality / Collaboration / Growth / B / C | leave `x` or untouched | untouched |

Write rates as decimals `0..1` (e.g. `0.95`) into J cells when numeric. Write `"x"` when not applicable.

## Required output

Return **only** a JSON object (no markdown fences):

```json
{
  "stats": {
    "committed": 0,
    "completed": 0,
    "incomplete": 0,
    "on_time_completed": 0,
    "on_time_eligible": 0,
    "commitment_rate": 0.0,
    "schedule_rate": null,
    "throughput_rate": null
  },
  "cell_updates": [
    { "sheet": "KPI Developer Demo", "cell": "J5", "value": 0.0 },
    { "sheet": "KPI Developer Demo", "cell": "K5", "value": 6.0 }
  ],
  "evidence": [
    { "key": "PROJ-1", "bucket": "completed|incomplete|excluded|on_time|late", "note": "..." }
  ],
  "notes": ["..."]
}
```

See [reference-mapping.md](reference-mapping.md) and [input-output.schema.md](input-output.schema.md).
