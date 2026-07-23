from fastapi import APIRouter, Depends

from app.dependencies import get_jira_service
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
async def list_projects(service: JiraService = Depends(get_jira_service)):
    return await service.get_projects()
