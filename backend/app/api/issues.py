from fastapi import APIRouter, Depends, Query

from app.dependencies import get_jira_service
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api", tags=["issues"])


@router.get("/issues")
async def list_issues(
    projects: str = Query(..., description="Comma-separated Jira project keys"),
    sprint: str | None = Query(default=None),
    board: str | None = Query(default=None, description="Jira board id (overrides sprint filter)"),
    assignee: str | None = Query(default=None),
    q: str | None = Query(default=None),
    service: JiraService = Depends(get_jira_service),
):
    project_keys = [item.strip() for item in projects.split(",") if item.strip()]
    return await service.get_issues(
        project_keys,
        sprint=sprint,
        board=board,
        assignee=assignee,
        query=q,
    )


@router.get("/summary")
async def get_summary(
    projects: str = Query(..., description="Comma-separated Jira project keys"),
    sprint: str | None = Query(default=None),
    board: str | None = Query(default=None, description="Jira board id (overrides sprint filter)"),
    assignee: str | None = Query(default=None),
    q: str | None = Query(default=None),
    service: JiraService = Depends(get_jira_service),
):
    project_keys = [item.strip() for item in projects.split(",") if item.strip()]
    return await service.get_summary(
        project_keys,
        sprint=sprint,
        board=board,
        assignee=assignee,
        query=q,
    )
