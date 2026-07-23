# KPI Developer — I/O schema

## Input

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role` | `"developer"` | yes | |
| `period.type` | `"sprint"` \| `"month"` | yes | |
| `period.sprint` | string | if sprint | `"active"` or sprint id |
| `period.month` | string | if month | `YYYY-MM` |
| `assignee` | string | yes | Jira display name |
| `projects` | string[] | yes | project keys |
| `issues` | Issue[] | yes | normalized issues |

### Issue

| Field | Type |
|-------|------|
| `key` | string |
| `summary` | string |
| `status_category` | string |
| `status_name` | string |
| `due_date` | string \| null |
| `updated` | string \| null |
| `story_points` | number \| null |

## Output

| Field | Type |
|-------|------|
| `stats.committed` | int |
| `stats.completed` | int |
| `stats.incomplete` | int |
| `stats.on_time_completed` | int |
| `stats.on_time_eligible` | int |
| `stats.commitment_rate` | number |
| `stats.schedule_rate` | number \| null |
| `stats.throughput_rate` | number \| null |
| `cell_updates` | `{ sheet, cell, value }[]` |
| `evidence` | `{ key, bucket, note }[]` |
| `notes` | string[] |

`value` in `cell_updates` is `number` or `"x"`.
