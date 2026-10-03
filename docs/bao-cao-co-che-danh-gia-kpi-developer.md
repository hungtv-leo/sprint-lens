# Báo cáo cơ chế đánh giá KPI Developer

**Nguồn tham chiếu:** sheet `KPI Developer Demo` và `Developer_tiêu chí A_full` trong template `backend/app/assets/kpi/kpi-template-vn.xlsx`  
**Đối tượng:** Nhân viên Developer  
**Mục đích tài liệu:** Mô tả chuẩn, chi tiết cách đo, cách quy đổi điểm và cách cộng dồn điểm KPI theo kỳ đánh giá.

---

## 1. Tổng quan cơ chế

Hệ thống KPI Developer đánh giá theo **3 tiêu chí lớn**, tổng tỷ trọng **100%** (theo công thức Excel trên sheet `KPI Developer Demo`):

| Tiêu chí | Tên | Tỷ trọng (công thức sheet) |
|----------|-----|----------|
| **A** | Hiệu quả công việc | **80%** nền (Delivery 35% + Quality 20% + Reliability 10% + Collaboration 10% + Growth 5%) + tối đa **+20% Impact Bonus** khi CBQL chấm |
| **B** | Tinh thần và trách nhiệm | **15%** |
| **C** | Kỷ luật lao động | **5%** |

Khi **chưa chấm Impact Bonus** (điểm bonus = 0): tổng max = **100%** (A 80% + B 15% + C 5%).  
Khi CBQL nhập điểm Impact Bonus (ô `O18`, thang 10): phần A tăng thêm tới **20%** (`0.2×O18/10`), tổng KPI có thể **vượt 100%**.

### Nguyên tắc chung

1. Mỗi chỉ tiêu con được chuẩn hóa về **thang điểm 10** (hoặc quy về tỷ lệ hoàn thành rồi map sang thang 10).
2. Điểm nhóm = **trung bình có trọng số** của các chỉ tiêu con.
3. Điểm tiêu chí lớn A/B/C = điểm nhóm × tỷ trọng tương ứng.
4. Có **hai kênh đánh giá song song**:
   - **Nhân viên đánh giá** (tự đánh giá)
   - **CBQL đánh giá** (cán bộ quản lý)
5. **Điểm tổng cộng cuối cùng** lấy trung bình có trọng số ưu tiên CBQL:

```text
TỔNG CỘNG = (Điểm_NV × 1 + Điểm_CBQL × 2) / 3
```

Nghĩa là điểm CBQL chiếm **2/3**, điểm nhân viên chiếm **1/3**.

---

## 2. Cấu trúc cột trên sheet đánh giá

| Nhóm cột | Ý nghĩa |
|----------|---------|
| STT | Số thứ tự / mã chỉ tiêu |
| CHỈ TIÊU / Hạng mục | Tên chỉ tiêu |
| Kế hoạch (Điểm) | Điểm kế hoạch (thường dùng cho tiêu chí B, C = 10) |
| Trọng số | Trọng số nội bộ trong nhóm |
| MÔ TẢ THƯỚC ĐO | Định nghĩa, phạm vi đo, phần loại trừ |
| Công thức Tính | Công thức / bảng quy đổi gốc |
| Công thức Tính (Thang điểm 10) | Bảng quy đổi về thang 10 |
| NHÂN VIÊN ĐÁNH GIÁ | Thực đạt / Điểm đạt / Tỷ lệ hoàn thành / Điểm KPI |
| CBQL ĐÁNH GIÁ | Cùng cấu trúc như cột nhân viên |

Với **tiêu chí A**: dùng chủ yếu cột **Tỷ lệ hoàn thành** + **Điểm KPI**.  
Với **tiêu chí B, C**: dùng **Thực đạt** + **Điểm đạt = Thực đạt / Kế hoạch**, rồi nhân trọng số và tỷ trọng nhóm.

---

## 3. Tiêu chí A — Hiệu quả công việc (80% theo công thức Excel)

### 3.1. Công thức tổng của A

Theo ô `F3` / `K3` trên sheet:

```text
A = 35% × Delivery
  + 20% × Quality
  + 10% × Reliability
  + 10% × Collaboration
  +  5% × Growth
  + 20% × Impact Bonus   (CBQL chấm; để 0 nếu không có)
```

Công thức Excel (thang điểm đã /10 để ra tỷ lệ đóng góp):

```text
A_NV   = (0.35×Delivery + 0.2×Quality + 0.1×Reliability + 0.1×Collaboration + 0.05×Growth + 0.2×ImpactBonus) / 10
A_CBQL = (cùng công thức với cột điểm CBQL; Impact Bonus thường ở O18)
```

Ví dụ: các nhóm nền đạt 10/10 và bonus = 0 → `A = 0.80` (**80%**), tổng A+B+C max = **100%**.  
Nếu CBQL chấm Impact Bonus = 10 → thêm 20%, `A = 1.00`, tổng có thể tới **120%**.

---

### 3.2. Delivery KPI (trọng số trong A: 35%)

**Mục đích:** Phản ánh khả năng chuyển giao công việc đã cam kết thành kết quả có giá trị.

```text
Delivery = 40% × Commitment Achievement
         + 25% × Schedule Performance
         + 20% × Work Throughput
         + 15% × Delivery Ownership
```

#### 3.2.1. Commitment Achievement (1.1) — trọng số 40% trong Delivery

**Định nghĩa:** Khả năng hoàn thành các Jira Task/Ticket đã cam kết.

**Công thức tỷ lệ:**

```text
Commitment rate = Số issue hoàn thành / Số issue đã cam kết
```

**Không tính vào cam kết / loại trừ:**

- Ticket bị hủy
- Scope thay đổi do PO/BA
- Công việc chưa đủ điều kiện triển khai
- Blocker ngoài khả năng kiểm soát

**Bảng quy đổi sang thang 10:**

| Tỷ lệ hoàn thành | Điểm /10 |
|------------------|----------|
| ≥ 100% | 10 |
| 95–99% | 9.5 |
| 90–94% | 9.0 |
| 80–89% | 8.0 |
| < 80% | 6.0 |

> Sprint Lens: ngày hoàn thành ưu tiên `resolutiondate` → `statuscategorychangedate` → `updated`.  
> Thiếu due date / story points: vẫn tính trên tập đủ dữ liệu (hiển thị coverage), hoặc `x` nếu không còn mẫu nào.
> Sprint Lens hiện chỉ auto-fill phần Delivery KPI (`1.1`, `1.2`, `1.3`) vào file mẫu; các phần Ownership, Quality, B, C vẫn cần đánh giá thủ công.

#### 3.2.2. Schedule Performance (1.2) — trọng số 25% trong Delivery

**Định nghĩa:** Mức độ hoàn thành đúng thời hạn (On-time Rate).

**Công thức tỷ lệ:**

```text
On-time Rate = Số issue hoàn thành đúng hạn / Số issue hoàn thành có due date
```

Issue không có `due date` không nằm trong mẫu số.

**Không tính delay do:**

- Requirement thay đổi
- Hạ tầng
- Phụ thuộc team khác

**Bảng quy đổi sang thang 10:**

| On-time Rate | Điểm /10 |
|--------------|----------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| 70–79% | 7.5 |
| < 70% | 6.0 |

#### 3.2.3. Work Throughput (1.3) — trọng số 20% trong Delivery

**Định nghĩa:** Khối lượng công việc hoàn thành theo Scope Score (theo level/cấp bậc nhân sự).

**Lưu ý quan trọng:**

- **Không** dùng số lượng Task/Ticket thuần
- Ưu tiên dùng **Scope Score** (ví dụ story points)

**Công thức gợi ý:**

```text
Throughput = Tổng Scope Score hoàn thành / Tổng Scope Score đã cam kết
```

**Bảng quy đổi sang thang 10:**

| Throughput | Điểm /10 |
|------------|----------|
| ≥ 95% | 10 |
| 90–94% | 9.5 |
| 80–89% | 8.5 |
| < 80% | 7.0 |

#### 3.2.4. Delivery Ownership (1.4) — trọng số 15% trong Delivery

**Định nghĩa:** Mức độ chủ động xử lý và đảm bảo tiến độ.  
**Cách chấm:** CBQL đánh giá theo rubric (định tính).

| Điểm /10 | Mô tả hành vi |
|----------|----------------|
| **10** | Luôn chủ động xử lý blocker, cảnh báo rủi ro sớm, đề xuất phương án khả thi |
| **9** | Chủ động trong hầu hết tình huống |
| **7.5** | Hoàn thành công việc được giao, biết báo cáo khi gặp khó khăn |
| **5** | Thường xuyên cần nhắc nhở |
| **2** | Bị động, ảnh hưởng đến tiến độ chung |

#### Ví dụ tính Delivery (theo số mẫu trên sheet — phía CBQL)

| Chỉ tiêu | Tỷ lệ / mức | Điểm | Hệ số |
|----------|-------------|------|-------|
| Commitment | 95% | 9.5 | 0.40 |
| Schedule | 89% | 8.5 | 0.25 |
| Throughput | 80% | 8.5 | 0.20 |
| Ownership | Rubric | 7.5 | 0.15 |

```text
Delivery_CBQL = 0.40×9.5 + 0.25×8.5 + 0.20×8.5 + 0.15×7.5
              = 3.80 + 2.125 + 1.70 + 1.125
              = 8.75
```

---

### 3.3. Quality KPI (trọng số trong A: 20%)

**Mục đích:** Phản ánh khả năng tạo ra phần mềm đáp ứng chất lượng trong toàn bộ SDLC — không chỉ đếm bug sau release.

```text
Quality = 25% × Code Quality
        + 20% × Testing Quality
        + 15% × Build & Release Quality
        + 25% × Production Quality
        + 15% × Quality Process Compliance
```

#### 3.3.1. Code Quality (2.1) — 25%

Đánh giá chất lượng mã nguồn trước khi merge.

| Khoảng điểm /10 | Đánh giá |
|-----------------|----------|
| 9.5–10 | Xuất sắc |
| 8.5–9.0 | Tốt |
| 7.0–8.0 | Đạt |
| 5.0–6.5 | Cần cải thiện |
| < 4.5 | Không đạt |

#### 3.3.2. Testing Quality (2.2) — 20%

Đánh giá chất lượng kiểm thử (self test). Tham số đầu vào gợi ý:

- Unit Test Coverage
- Integration Test
- Regression Test
- Test Pass Rate
- Flaky Test

#### 3.3.3. Build & Release Quality (2.3) — 15%

Tham số: Build Success Rate, Failed Build, Rollback, Release Checklist.

| Điều kiện | Điểm /10 |
|-----------|----------|
| Không lỗi build, không rollback | 10 |
| 1 failed build nhỏ | 9.5 |
| Nhiều failed build | 8.0 |
| Rollback Production | 6.0 |

#### 3.3.4. Production Quality (2.4) — 25%

Nhóm phản ánh **outcome** chất lượng. Tham số: Escaped Defects, Critical Bug, P1 Incident, Customer Complaint.

| Điều kiện | Điểm /10 |
|-----------|----------|
| Không Critical Bug | 10 |
| 1 Minor Bug | 9.5 |
| 2 Minor Bug | 9.0 |
| Có Critical Bug | 7.0 |
| Có P1 Incident | 5.0 |

#### 3.3.5. Quality Process Compliance (2.5) — 15%

Tuân thủ practice chất lượng: PR Checklist, Definition of Done, Coding Standard, Review Checklist, Documentation.

| Điểm /10 | Mô tả |
|----------|-------|
| **10** | Luôn tuân thủ đầy đủ quy trình |
| **9** | Có thiếu sót nhỏ |
| **7.5** | Đôi khi bỏ qua checklist |
| **5** | Thường xuyên vi phạm |
| **2** | Không tuân thủ quy trình |

---

### 3.4. Reliability KPI (trọng số trong A: 10%)

**Mục đích:** Khả năng đảm bảo hệ thống vận hành ổn định sau khi thay đổi.

**Không đánh giá:** số lượng Incident xử lý, ticket support, thời gian online.  
**Có đánh giá:** ổn định phần mềm, chất lượng release, phòng ngừa incident, khả năng phục hồi.

Công thức chi tiết (sheet `Developer_tiêu chí A_full`):

```text
Reliability = 35% × Change Reliability
            + 30% × Incident Quality
            + 20% × Recovery Effectiveness
            + 15% × Operational Discipline
```

| Thành phần | Đầu vào gợi ý |
|------------|----------------|
| Change Reliability | Change Failure Rate, Rollback Rate, Failed Deployment |
| Incident Quality | Critical / P1 / P2 Incident, Escaped Production Issue |
| Recovery Effectiveness | MTTR, Recovery Plan, Root Cause Analysis |
| Operational Discipline | Monitoring, Alert Handling, Release Checklist, Runbook |

Trên sheet Demo, chỉ tiêu này thường được nhập trực tiếp điểm thang 10 (cá nhân + manager).

---

### 3.5. Collaboration KPI (trọng số trong A: 10%)

**Mục đích:** Khả năng phối hợp nâng cao hiệu quả team — không phải giao tiếp đơn thuần.

Đánh giá: chia sẻ tri thức, code review, hỗ trợ đồng đội, phối hợp liên nhóm, ảnh hưởng tích cực.

```text
Collaboration = 30% × Code Review Contribution
              + 30% × Team Collaboration
              + 20% × Knowledge Sharing
              + 20% × Cross-team Collaboration
```

Trên sheet Demo thường tự đánh giá / CBQL nhập điểm thang 10.

---

### 3.6. Growth KPI (trọng số trong A: 5%)

**Mục đích:** Phát triển năng lực cá nhân và đóng góp phát triển tổ chức.

**Không đánh giá:** số giờ học, số chứng chỉ, số khóa học.  
**Có đánh giá:** phát triển kỹ năng, áp dụng kiến thức vào việc, cải tiến, phát triển người khác.

```text
Growth = 35% × Learning Goal Achievement
       + 25% × Skill Improvement
       + 25% × Continuous Improvement
       + 15% × Knowledge Contribution
```

---

## 4. Tiêu chí B — Tinh thần và trách nhiệm (15%)

**Công thức từng hạng mục:**

```text
Điểm đóng góp = Trọng số × Điểm đạt × 15%
Điểm đạt      = Thực đạt / Kế hoạch
```

Kế hoạch mặc định mỗi hạng mục = **10 điểm**.

| STT | Hạng mục | Trọng số nội bộ |
|-----|----------|-----------------|
| 1 | Chủ động trong công việc | 0.30 |
| 2 | Phối hợp trong công việc | 0.30 |
| 3 | Tuân thủ kỷ luật trong công việc, chấp hành yêu cầu cấp trên và nội quy | 0.40 |

Tổng trọng số nội bộ B = 1.0.  
Tổng điểm B = tổng các điểm đóng góp của 3 hạng mục (tối đa ~15%).

---

## 5. Tiêu chí C — Kỷ luật lao động (5%)

**Công thức từng hạng mục:**

```text
Điểm đóng góp = Trọng số × Điểm đạt × 5%
Điểm đạt      = Thực đạt / Kế hoạch
```

| STT | Hạng mục | Trọng số nội bộ |
|-----|----------|-----------------|
| 1 | Đi muộn, về sớm | 0.30 |
| 2 | Nghỉ không phép | 0.30 |
| 3 | Quên không chấm công (check-in / check-out) | 0.30 |
| 4 | Xanh – Sạch – Đẹp | 0.10 |

Tổng trọng số nội bộ C = 1.0.  
Tổng điểm C tối đa ~5%.

Chi tiết cách trừ điểm / bảng mức độ tham chiếu sheet `Bảng tiêu chí B,C`.

---

## 6. Cộng dồn điểm tổng

### 6.1. Điểm từng bên (NV và CBQL)

```text
Tổng_NV   = A_NV   + B_NV   + C_NV
Tổng_CBQL = A_CBQL + B_CBQL + C_CBQL
```

Trong Excel:

```text
= SUM(điểm A, điểm B, điểm C)
```

### 6.2. Điểm chốt kỳ

```text
TỔNG CỘNG = (Tổng_NV × 1 + Tổng_CBQL × 2) / 3
```

---

## 7. Quy trình đánh giá khuyến nghị

1. **Thu thập số liệu kỳ** (sprint / tháng): issue Jira, due date, story points/scope, build/release, bug production…
2. **Tính các tỷ lệ định lượng** của Delivery (1.1, 1.2, 1.3) và map sang thang 10 theo bảng ngưỡng.
3. **Chấm định tính** theo rubric: Delivery Ownership, Quality Process, Collaboration, Growth…
4. **Nhân viên** điền cột tự đánh giá.
5. **CBQL** đối chiếu bằng chứng, điều chỉnh tỷ lệ/điểm.
6. Sheet tự cộng dồn A → B → C → Tổng từng bên → **Tổng cộng** theo trọng số 1:2.

---

## 8. Lưu ý vận hành (Sprint Lens)

Trong hệ thống Sprint Lens, phần **auto-fill từ Jira** tập trung vào Delivery:

| Chỉ tiêu | Có auto tính từ Jira? |
|----------|------------------------|
| 1.1 Commitment Achievement | Có |
| 1.2 Schedule Performance | Có (nếu có due date) |
| 1.3 Work Throughput | Có nếu có story points / scope; không thì để `x` |
| 1.4 Delivery Ownership | Không (giữ định tính / `x`) |
| Quality / Reliability / Collaboration / Growth | Không auto |
| Tiêu chí B, C | Không auto |

Định nghĩa kỹ thuật khi tính từ Jira (theo skill KPI Developer):

- **Committed:** mọi issue trừ cancelled (`cancel` / `hủy` / `won't` / `withdrawn`)
- **Completed:** committed và `status_category = done`
- **Commitment rate** = completed / committed
- **Schedule rate** = on-time completed / completed có due date
- **Throughput rate** = tổng SP completed / tổng SP committed (nếu có SP)

---

## 9. Sơ đồ tóm tắt

```text
                    ┌─────────────────────────────────────┐
                    │         TỔNG CỘNG KPI               │
                    │  (NV×1 + CBQL×2) / 3                │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
     A. Hiệu quả 80%        B. Tinh thần 15%        C. Kỷ luật 5%
           │
     ┌─────┴──────────────────────────────────────────┐
     ▼         ▼          ▼            ▼           ▼
 Delivery  Quality  Reliability  Collaboration  Growth  ImpactBonus
   35%       20%       10%          10%         5%       20%*
     │
     ├─ 40% Commitment Achievement   (định lượng)
     ├─ 25% Schedule Performance     (định lượng)
     ├─ 20% Work Throughput          (định lượng)
     └─ 15% Delivery Ownership       (rubric CBQL)

(*) Impact Bonus mặc định 0 → tổng max 100%; CBQL chấm thì tổng tăng (tới +20%).
```

---

## 10. Kết luận ngắn

Cơ chế KPI Developer là **mô hình trọng số nhiều tầng**:

1. Chuẩn hóa chỉ tiêu về **thang 10** (bảng ngưỡng hoặc rubric).
2. Gộp thành điểm nhóm bằng **trọng số nội bộ**.
3. Nhân **tỷ trọng tiêu chí A/B/C**.
4. Chốt kỳ bằng công thức **ưu tiên CBQL (2/3)**, nhân viên (1/3).

Phần Delivery định lượng là xương sống đo hiệu quả giao hàng; Quality–Growth và B/C bổ sung chất lượng, hợp tác, phát triển và kỷ luật để phản ánh hiệu suất toàn diện.
