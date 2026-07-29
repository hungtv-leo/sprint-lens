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
  "plan_items": [],
  "issues": [
    {
      "key": "PROJ-1",
      "summary": "...",
      "status_category": "done|indeterminate|new",
      "status_name": "...",
      "due_date": "YYYY-MM-DD|null",
      "resolution_date": "ISO-8601|null",
      "status_category_change_date": "ISO-8601|null",
      "updated": "ISO-8601|null",
      "story_points": null
    }
  ]
}
```

## Definitions

- **Committed**: all issues in the dataset except cancelled (status name contains `cancel` / `hủy` / `won't` / `withdrawn`). When `plan_items` exist, only `plan_type=committed` without exclusion reason.
- **Completed**: committed issues with `status_category == "done"`.
- **Incomplete**: committed − completed.
- **Commitment Achievement rate** = `completed / committed` (0 if committed = 0).
- **Completion date** priority: `resolution_date` → `status_category_change_date` → `updated`.
- **Due date** priority: Jira `due_date` → plan `expected_due_date`. Issues missing both are excluded from Schedule denominator.
- **On-time completed**: completed + has due + completion_date ≤ due.
- **Schedule Performance rate** = `on_time_completed / on_time_eligible`. If none eligible → rate `null`, J6/K6 = `"x"`.
- **Work Throughput**: no raw ticket counts. Per committed issue, scope = `story_points` if set, else plan `scope_score`. Issues missing both are excluded from throughput. Rate = `sum(scope completed eligible) / sum(scope committed eligible)`. If none eligible → J7/K7 = `"x"`. Source may be `story_points`, `scope_score`, or `hybrid`.

## Score tables (column K) — khớp Excel KPI Developer Demo

### Commitment Achievement (1.1)

| Rate | Score |
|------|-------|
| ≥ 1.00 | 10 |
| ≥ 0.95 | 9.5 |
| ≥ 0.90 | 9.0 |
| ≥ 0.80 | 8.0 |
| < 0.80 | 6.0 |

### Schedule Performance (1.2)

| Rate | Score |
|------|-------|
| ≥ 0.95 | 10 |
| ≥ 0.90 | 9.5 |
| ≥ 0.80 | 8.5 |
| ≥ 0.70 | 7.5 |
| < 0.70 | 6.0 |

### Work Throughput (1.3)

| Rate | Score |
|------|-------|
| ≥ 0.95 | 10 |
| ≥ 0.90 | 9.5 |
| ≥ 0.80 | 8.5 |
| < 0.80 | 7.0 |

## Excel mapping — sheet `KPI Developer Demo`

| Metric | H (thực đạt) | I (mẫu số) | J (tỷ lệ) | K (điểm) |
|--------|--------------|------------|-----------|----------|
| Commitment Achievement | completed | committed | J5 | K5 |
| Schedule Performance | on_time_completed | on_time_eligible | J6 | K6 |
| Work Throughput | completed scope | committed scope | J7 | K7 |
| Delivery Ownership | leave `x` | leave `x` | leave `x` | leave as-is |
| Quality / Collaboration / Growth / B / C | leave `x` or untouched | untouched | untouched | untouched |

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
    "schedule_source": "none",
    "schedule_coverage": null,
    "throughput_rate": null,
    "throughput_source": "none",
    "throughput_coverage": null
  },
  "cell_updates": [
    { "sheet": "KPI Developer Demo", "cell": "J5", "value": 0.0 },
    { "sheet": "KPI Developer Demo", "cell": "K5", "value": 6.0 }
  ],
  "evidence": [
    { "key": "PROJ-1", "bucket": "completed|incomplete|excluded|on_time|late", "note": "..." }
  ],
  "notes": ["..."],
  "trace": ["..."]
}
```

See [reference-mapping.md](reference-mapping.md) and [input-output.schema.md](input-output.schema.md).
