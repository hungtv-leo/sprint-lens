# Sprint Lens

Sprint Lens là dashboard nội bộ giúp theo dõi sprint Jira theo project, trạng thái và người được giao trong một giao diện nhanh, trực quan và dễ quan sát.

## Stack

- Backend: Python FastAPI
- Frontend: React + TypeScript + Vite
- UI: Ant Design, Recharts
- Chạy: self-host trên máy local (Docker Compose hoặc uvicorn + Vite)
- CI: GitHub Actions (lint + build)

> Jira nội bộ cần VPN — backend phải chạy trên máy đã kết nối VPN (không dùng Render/cloud public).

## Cấu trúc

```text
backend/   FastAPI API proxy tới Jira
frontend/  Dashboard và bảng Kanban
```

## Backend env

Tạo file `backend/.env` từ `backend/.env.example`:

```env
JIRA_BASE_URL=https://jira.trangnguyen.edu.vn
JIRA_PERSONAL_ACCESS_TOKEN=your-personal-access-token
JIRA_DEFAULT_PROJECTS=PROJ1,PROJ2
CACHE_TTL_SECONDS=30
```

Mặc định hiện tại backend ưu tiên `Personal Access Token` qua header:

```http
Authorization: Bearer <your-personal-access-token>
```

Nếu sau này Jira cần `email + api token`, backend vẫn có sẵn đường mã rỗng để hỗ trợ tiếp.

## Frontend env

Tạo file `frontend/.env` từ `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8787
```

## Self-host trên máy local

Bật **VPN công ty** trước khi chạy backend.

### Cách 1 — Hai terminal (dev)

**Terminal 1 — Backend:**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8787
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Mở: `http://localhost:5173`

Kiểm tra API: `http://localhost:8787/health` → `{"status":"ok"}`

### Cách 2 — Docker Compose

Chuẩn bị `backend/.env` và `frontend/.env`, rồi:

```bash
docker compose up --build
```

- Backend: `http://localhost:8787`
- Frontend: `http://localhost:4173`

## API endpoints

- `GET /health`
- `GET /api/projects`
- `GET /api/statuses?project=PROJECT_KEY`
- `GET /api/sprints?project=PROJECT_KEY`
- `GET /api/issues?projects=AAA,BBB&sprint=active`
- `GET /api/summary?projects=AAA,BBB&sprint=active`
- `GET /api/users?projects=AAA,BBB&q=optional` — danh sách nhân viên assignable theo project
- `POST /api/kpi/calculate` — Agent đọc skill theo role, trả stats KPI
- `POST /api/kpi/export` — Agent tính toán rồi điền file KPI mẫu (xlsx)

Skill Developer nằm tại `.cursor/skills/kpi-developer/`. Module UI: `/kpi`.

Optional env cho Agent:

```env
CURSOR_API_KEY=
KPI_PREFER_CURSOR_AGENT=true
```

Nếu chưa có `CURSOR_API_KEY`, backend dùng `local-skill` agent (áp dụng cứng rule trong skill).

## CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) chạy lint + build trên mỗi push/PR `master`. Không deploy cloud.

## Ghi chú

- Sprint Lens đọc dữ liệu Jira theo token, không đẩy token xuống trình duyệt.
- Backend hiện tại hỗ trợ `Personal Access Token` để kết nối Jira.
- Bảng hiện tại là chỉ đọc, an toàn cho giai đoạn đầu.
- Nếu Jira của công ty dùng custom sprint field khác `customfield_10007`, cần cập nhật trong `backend/app/services/jira_service.py`.
- Site GitHub Pages cũ (nếu còn) không lấy được data Jira vì backend không còn trên internet; dùng `localhost` ở trên.
