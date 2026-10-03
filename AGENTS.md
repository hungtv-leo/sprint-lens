# AGENTS.md

## Project

Sprint Lens is an internal Jira sprint dashboard (read-only). Backend: Python FastAPI proxy to Jira. Frontend: React + TypeScript + Vite (Ant Design, Recharts). Self-host local only (VPN required for live Jira). Existing ritual: `.cursor/skills/kpi-developer/`.

## Layout

- `backend/app/api/` — route handlers
- `backend/app/services/` — Jira, KPI, ops logic
- `backend/app/schemas/` — Pydantic models
- `backend/tests/` — pytest
- `frontend/src/pages/` — route pages
- `frontend/src/components/` — UI (dashboard, kanban, layout)
- `frontend/src/hooks/` — React Query hooks
- `frontend/src/lib/` — API client + types
- `.cursor/skills/kpi-developer/` — Developer KPI fill/export skill

## Required loop (until Done)

1. Make the minimal code change for the task
2. Run **Verify commands** for paths you touched
3. FAIL → fix → repeat step 2
4. PASS + Definition of done → report complete

Max **8** loops. If still failing, stop, summarize, ask the user.

On feature / hotfix / bugfix: follow skill `ship-change`, then `verify-until-done`. Do not stop after editing files only.

## Commands

**Dev**

```bash
# Terminal 1 — backend (VPN on for live Jira)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8787

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

**Docker (optional)**

```bash
docker compose up --build
```

## Verify commands

| Touched | Fast gate (each loop) | Full gate (before Done) |
|---------|----------------------|-------------------------|
| `frontend/**` | `cd frontend && npm run lint` | `cd frontend && npm run build` |
| `backend/**` | `cd backend && python -m pytest` | `cd backend && python -c "from app.main import app; print(app.title)"` (set dummy `JIRA_BASE_URL` + `JIRA_PERSONAL_ACCESS_TOKEN` if unset) |
| Both / unclear | Both fast gates | Both full gates |

CI mirror: `.github/workflows/ci.yml` (frontend lint+build, backend import smoke). Prefer local verify from this table.

Unit-test-only backend work: do **not** call live Jira or require VPN.

## Hard stop

- Do not commit `backend/.env`, `frontend/.env`, tokens, or secrets
- Do not force-push; do not `--no-verify` unless the user asks
- Do not claim Done while verify is red
- Do not call live Jira / require VPN for pure unit-test or offline logic changes
- Do not deploy, push Docker images, or change remote infra unless the user asks
- Do not commit / push / open a PR unless the user explicitly asks

## Do / Don't

- **Do:** match existing patterns under `backend/app/` and `frontend/src/`
- **Do:** use `.cursor/skills/kpi-developer/` for Developer KPI calculate/export work
- **Don't:** invent a new stack, skip verify, or guess PASS
- **Don't:** put Jira credentials in frontend code

## Definition of done

- [ ] Task scope complete
- [ ] Verify PASS (actually run)
- [ ] No secrets exposed
- [ ] State which verify commands were used
- [ ] No commit/PR/deploy unless requested
