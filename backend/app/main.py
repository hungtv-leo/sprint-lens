from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.boards import router as boards_router
from app.api.issues import router as issues_router
from app.api.kpi import router as kpi_router
from app.api.ops import router as ops_router
from app.api.projects import router as projects_router
from app.api.sprints import router as sprints_router
from app.api.statuses import router as statuses_router
from app.api.system import router as system_router
from app.api.users import router as users_router

app = FastAPI(title="Sprint Lens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def healthcheck():
    return {"status": "ok"}


app.include_router(projects_router)
app.include_router(boards_router)
app.include_router(issues_router)
app.include_router(statuses_router)
app.include_router(sprints_router)
app.include_router(users_router)
app.include_router(system_router)
app.include_router(kpi_router)
app.include_router(ops_router)
