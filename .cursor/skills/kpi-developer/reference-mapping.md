# KPI Developer — Excel reference

Template: `backend/app/assets/kpi/kpi-template-vn.xlsx`  
Sheet: `KPI Developer Demo`

## Tiêu chí A — Delivery (điền từ Jira / kế hoạch)

| STT | Hạng mục | Ô thực đạt (H) | Ô mẫu số (I) | Ô tỷ lệ (J) | Ô điểm (K) | Nguồn |
|-----|----------|----------------|--------------|-------------|------------|--------|
| 1.1 | Commitment Achievement | H5 | I5 | J5 | K5 | completed / committed |
| 1.2 | Schedule Performance | H6 | I6 | J6 | K6 | on-time / completed-with-due |
| 1.3 | Work Throughput | H7 | I7 | J7 | K7 | story points / scope score (partial OK) |
| 1.4 | Delivery Ownership | — | — | J8=`x` | K8 as-is | qualitative |

## Dữ liệu thiếu

- Thiếu `due_date` Jira → dùng hạn kế hoạch; thiếu cả hai → loại khỏi Schedule, ghi note.
- Thiếu `story_points` → dùng Scope Score kế hoạch cho issue đó; thiếu cả hai → loại khỏi Throughput.
- Coverage < 100% vẫn tính được trên tập đủ dữ liệu; ghi `schedule_coverage` / `throughput_coverage`.

## Ngày hoàn thành

Ưu tiên: `resolutiondate` → `statuscategorychangedate` → `updated`.

## Không auto-fill

- Quality KPI (rows 9–14)
- Reliability / Collaboration / Growth (15–17)
- Tiêu chí B / C (rows 18+)

## Thang điểm Commitment (1.1)

| Tỷ lệ hoàn thành | Điểm (thang 10) |
|------------------|-----------------|
| ≥ 100% | 10 |
| 95–99% | 9.5 |
| 90–94% | 9.0 |
| 80–89% | 8.0 |
| < 80% | 6.0 |

## Thang điểm Schedule (1.2)

| On-time Rate | Điểm (thang 10) |
|--------------|-----------------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| 70–79% | 7.5 |
| < 70% | 6.0 |

## Thang điểm Throughput (1.3)

| Throughput | Điểm (thang 10) |
|------------|-----------------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| < 80% | 7.0 |
