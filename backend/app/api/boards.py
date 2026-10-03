from fastapi import APIRouter, Depends, Query

from app.dependencies import get_jira_service
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api/boards", tags=["boards"])


@router.get("")
async def list_boards(
    projects: str | None = Query(default=None, description="Comma-separated project keys"),
    project: str | None = Query(default=None, description="Single project key (legacy)"),
    service: JiraService = Depends(get_jira_service),
):
    project_keys = [item.strip() for item in (projects or "").split(",") if item.strip()]
    if not project_keys and project:
        project_keys = [project.strip()]
    if not project_keys:
        return []
    if len(project_keys) == 1:
        return await service.get_boards(project_keys[0])
    return await service.get_boards_for_projects(project_keys)
