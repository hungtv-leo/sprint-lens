from fastapi import APIRouter, Depends, Query

from app.dependencies import get_jira_service
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(
    projects: str = Query(..., description="Comma-separated Jira project keys"),
    q: str | None = Query(default=None, description="Search by name/email"),
    service: JiraService = Depends(get_jira_service),
):
    project_keys = [item.strip() for item in projects.split(",") if item.strip()]
    return await service.get_users(project_keys, query=q)
