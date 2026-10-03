# KPI Developer — Excel reference

Template: `backend/app/assets/kpi/kpi-template-vn.xlsx`  
Sheets: `KPI Developer Demo` (Nhân viên) · `KPI Lead Developer Demo` (Leader)  
Criteria text: `Developer_tiêu chí A_full`

## Tiêu chí A — Delivery (điền từ Jira / kế hoạch)

| STT | Hạng mục | Ô thực đạt (H) | Ô mẫu số (I) | Ô tỷ lệ (J) | Ô điểm (K) | Nguồn |
|-----|----------|----------------|--------------|-------------|------------|--------|
| 1.1 | Commitment Achievement | H5 | I5 | J5 | K5 | completed / committed |
| 1.2 | Schedule Performance | H6 | I6 | J6 | K6 | on-time / completed-with-due |
| 1.3 | Work Throughput | H7 | I7 | J7 | K7 | story points / scope score (partial OK) |
| 1.4 | Delivery Ownership | — | — | J8=`x` | K8 as-is | qualitative (không auto-fill) |

Khi export, các ô Nhân viên (H–K) được mirror sang CBQL (L–O).

## Trọng số sheet (không do agent tính)

| Nhóm | Trọng số | Ghi chú |
|------|----------|---------|
| Delivery | 35% trong A | `K4` = 40%×K5 + 25%×K6 + 20%×K7 + 15%×K8 |
| Quality | 20% | rows 9–14 |
| Reliability / Collaboration / Growth | 10% / 10% / 5% | rows 15–17 |
| Impact Bonus | 20% | row 18; `K18`/`O18` mặc định **0** |
| B — Tinh thần | 15% | rows 23–26 |
| C — Kỷ luật | 5% | rows 27–31 |

`K3/O3 = (0.35*Delivery + 0.2*Quality + 0.1*Reliability + 0.1*Collaboration + 0.05*Growth + 0.2*ImpactBonus) / 10`  
Không chấm bonus → A max 80% + B 15% + C 5% = **100%**. CBQL nhập `O18` → tổng tăng (tối đa +20%).

## Dữ liệu thiếu

- Thiếu `due_date` Jira → dùng hạn kế hoạch; thiếu cả hai → loại khỏi Schedule, ghi note.
- Thiếu `story_points` → dùng Scope Score kế hoạch cho issue đó; thiếu cả hai → loại khỏi Throughput.
- Coverage < 100% vẫn tính được trên tập đủ dữ liệu; ghi `schedule_coverage` / `throughput_coverage`.

## Ngày hoàn thành

Ưu tiên: `resolutiondate` → `statuscategorychangedate` → `updated`.

Với `period.type=month`: issue Done nhưng ngày hoàn thành **ngoài tháng** → incomplete cho Commitment/Schedule.

## Không auto-fill

- Delivery Ownership (row 8)
- Quality KPI (rows 9–14)
- Reliability / Collaboration / Growth (15–17)
- Impact Bonus (row 18) — để 0; CBQL chỉnh `O18`
- Tiêu chí B (rows 23–26) / C (rows 27–31)

## Thang điểm Commitment (1.1)

| Tỷ lệ hoàn thành | Điểm (thang 10) |
|------------------|-----------------|
| ≥ 100% | 10 |
| 95–99% | 9.5 |
| 90–94% | 9.0 |
| 80–89% | 8.0 |
| < 80% | 6.0 |
| không có cam kết (`null`) | `x` |

## Thang điểm Schedule (1.2)

| On-time Rate | Điểm (thang 10) |
|--------------|-----------------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| 70–79% | 7.5 |
| < 70% | 6.0 |
| không đủ dữ liệu (`null`) | `x` |

## Thang điểm Throughput (1.3)

| Throughput | Điểm (thang 10) |
|------------|-----------------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| < 80% | 7.0 |
| không đủ dữ liệu (`null`) | `x` |
