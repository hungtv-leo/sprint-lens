from fastapi import APIRouter, Depends, Query

from app.dependencies import get_jira_service
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api/statuses", tags=["statuses"])


@router.get("")
async def list_statuses(
    project: str = Query(..., description="Jira project key"),
    service: JiraService = Depends(get_jira_service),
):
    return await service.get_statuses(project)
