---
name: kpi-developer
description: >-
  Computes Developer KPI rates from Jira issues (commitment, schedule, throughput)
  and maps them onto the KPI Developer Demo Excel sheet. Use when calculating or
  exporting Developer KPI for sprint or month periods.
---

# KPI Developer

Agent-agnostic skill for Sprint Lens. Load this skill when the role is `developer` or `lead_developer`.

## When to use

- User exports or calculates Developer / Lead Developer KPI
- Need completed vs incomplete task stats for a sprint or calendar month
- Need to fill sheet `KPI Developer Demo` (role=`developer`) or `KPI Lead Developer Demo` (role=`lead_developer`)

## Inputs

Expect JSON:

```json
{
  "role": "developer|lead_developer",
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

UI maps **Nhân viên** → `developer`, **Leader** → `lead_developer`. Same plan sheet and Delivery math; only the Excel target sheet differs.
## Definitions

- **Committed**: all issues in the dataset except cancelled (status name contains `cancel` / `hủy` / `won't` / `withdrawn`). When `plan_items` exist, only `plan_type=committed` without exclusion reason.
- **Completed** (Commitment / Schedule):
  - Sprint: committed issues with `status_category == "done"`.
  - Month: same, **and** completion date must fall inside the requested month. Done outside the month counts as **incomplete** for that month KPI.
- **Incomplete**: committed − completed.
- **Commitment Achievement rate** = `completed / committed`. If `committed = 0` → rate `null`, J5/K5 = `"x"`.
- **Completion date** priority: `resolution_date` → `status_category_change_date` → `updated`.
- **Due date** priority: Jira `due_date` → plan `expected_due_date`. Issues missing both are excluded from Schedule denominator.
- **On-time completed**: completed + has due + completion_date ≤ due.
- **Schedule Performance rate** = `on_time_completed / on_time_eligible`. If none eligible → rate `null`, J6/K6 = `"x"`.
- **Work Throughput**: no raw ticket counts. Per committed issue, scope = `story_points` if set, else plan `scope_score`. Issues missing both are excluded from throughput. Rate = `sum(scope of Done issues) / sum(scope committed eligible)` using `status_category == "done"` for the numerator (month-boundary filter above applies to Commitment/Schedule, not this numerator). If none eligible → J7/K7 = `"x"`. Source may be `story_points`, `scope_score`, or `hybrid`.

## Score tables (column K) — khớp Excel KPI Developer Demo

### Commitment Achievement (1.1)

| Rate | Score |
|------|-------|
| ≥ 1.00 | 10 |
| ≥ 0.95 | 9.5 |
| ≥ 0.90 | 9.0 |
| ≥ 0.80 | 8.0 |
| < 0.80 | 6.0 |
| `null` (no committed) | `"x"` |

### Schedule Performance (1.2)

| Rate | Score |
|------|-------|
| ≥ 0.95 | 10 |
| ≥ 0.90 | 9.5 |
| ≥ 0.80 | 8.5 |
| ≥ 0.70 | 7.5 |
| < 0.70 | 6.0 |
| `null` | `"x"` |

### Work Throughput (1.3)

| Rate | Score |
|------|-------|
| ≥ 0.95 | 10 |
| ≥ 0.90 | 9.5 |
| ≥ 0.80 | 8.5 |
| < 0.80 | 7.0 |
| `null` | `"x"` |

## Excel mapping — sheet theo role

| `role` | Sheet đích |
|--------|------------|
| `developer` (Nhân viên) | `KPI Developer Demo` |
| `lead_developer` (Leader) | `KPI Lead Developer Demo` |

Agent chỉ trả `cell_updates` cho Delivery `H5`–`K7` trên sheet đích. Khi **export**, Sprint Lens:
- mirror Nhân viên → CBQL (`H→L`, `I→M`, `J→N`, `K→O`) để CBQL bắt đầu cùng số liệu;
- giữ công thức tổng; không auto-chấm Ownership / Quality / Leadership / Impact Bonus / B / C.

Trọng số template **Developer**:
- A nền: Delivery **35%** + Quality 20% + Reliability 10% + Collaboration 10% + Growth 5% (= **80%**)
- Impact Bonus **20%** qua `K18`/`O18` (mặc định **0**)
- B **15%** + C **5%** → không chấm bonus thì tổng max **100%**

Trọng số template **Lead**:
- A: Delivery **35%** + Quality 20% + Rel 5% + Collab 5% + Growth 5% + Leadership **10%** (`K18`) + Impact Bonus **20%** (`K23`)
- Leadership/Bonus mặc định **0** (không auto); B **15%** + C **5%**
- Công thức: `K3 = (0.35*K4+0.2*K9+0.05*K15+0.05*K16+0.05*K17+0.1*K18+0.2*K23)/10`

| Metric | H (thực đạt) | I (mẫu số) | J (tỷ lệ) | K (điểm) |
|--------|--------------|------------|-----------|----------|
| Commitment Achievement | completed | committed | J5 | K5 |
| Schedule Performance | on_time_completed | on_time_eligible | J6 | K6 |
| Work Throughput | completed scope | committed scope | J7 | K7 |
| Delivery Ownership (1.4) | leave `x` | leave `x` | leave `x` | leave as-is (thường 10 mẫu / CBQL sửa) |
| Impact Bonus (row 18) | leave | leave | leave `x` | leave `0` (CBQL chỉnh `O18`) |
| Quality / Reliability / Collaboration / Growth / B / C | leave / untouched | untouched | untouched | untouched |

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
    "commitment_rate": null,
    "schedule_rate": null,
    "schedule_source": "none",
    "schedule_coverage": null,
    "throughput_rate": null,
    "throughput_source": "none",
    "throughput_coverage": null
  },
  "cell_updates": [
    { "sheet": "KPI Developer Demo", "cell": "J5", "value": "x" },
    { "sheet": "KPI Developer Demo", "cell": "K5", "value": "x" }
  ],
  "evidence": [
    { "key": "PROJ-1", "bucket": "completed|incomplete|excluded|on_time|late|missing_jira", "note": "..." }
  ],
  "notes": ["..."],
  "trace": ["..."]
}
```

`commitment_rate` / `schedule_rate` / `throughput_rate` may be `null`. Cell `value` is `number` or `"x"`.

See [reference-mapping.md](reference-mapping.md) and [input-output.schema.md](input-output.schema.md).
