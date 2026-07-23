# Sprint Lens

Sprint Lens là dashboard nội bộ giúp theo dõi sprint Jira theo project, trạng thái và người được giao trong một giao diện nhanh, trực quan và dễ quan sát.

## Stack

- Backend: Python FastAPI
- Frontend: React + TypeScript + Vite
- UI: Ant Design, Recharts
- Deploy: Docker Compose

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

Nếu sau này Jira cần `email + api token`, backend vẫn có sẵn đường mở rộng để hỗ trợ tiếp.

## Frontend env

Tạo file `frontend/.env` từ `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8787
```

## Chạy local

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy trên URL do Vite cung cấp, thường là `http://localhost:5173`.

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

Nếu chưa có `CURSOR_API_KEY`, backend dùng `local-skill` agent (áp dụng cùng rule trong skill).

## Docker

Chuẩn bị:

- `backend/.env`
- `frontend/.env`

Sau đó chạy:

```bash
docker compose up --build
```

Khi đó:

- Backend: `http://localhost:8787`
- Frontend: `http://localhost:4173`

## Ghi chú

- Sprint Lens đọc dữ liệu Jira theo token, không đẩy token xuống trình duyệt.
- Backend hiện tại hỗ trợ `Personal Access Token` để kết nối Jira.
- Bảng hiện tại là chỉ đọc, an toàn cho giai đoạn đầu.
- Nếu Jira của công ty dùng custom sprint field khác `customfield_10007`, cần cập nhật trong `backend/app/services/jira_service.py`.
