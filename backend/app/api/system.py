from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.dependencies import get_jira_service
from app.schemas.jira import AppConfigResponse, JiraHealthResponse
from app.services.jira_service import JiraService

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/config", response_model=AppConfigResponse)
async def get_app_config(settings: Settings = Depends(get_settings)):
    return AppConfigResponse(
        default_projects=settings.default_projects,
        sprint_custom_field=settings.jira_sprint_custom_field,
    )


@router.get("/health/jira", response_model=JiraHealthResponse)
async def jira_health(service: JiraService = Depends(get_jira_service)):
    return await service.check_jira_health()
