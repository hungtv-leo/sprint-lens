from fastapi import APIRouter, Depends, Query

from app.dependencies import get_weekly_report_service
from app.schemas.weekly_report import WeeklyReportResponse
from app.services.weekly_report_service import WeeklyReportService

router = APIRouter(prefix="/api/weekly-report", tags=["weekly-report"])


@router.get("", response_model=WeeklyReportResponse)
async def get_weekly_report(
    projects: str = Query(..., description="Comma-separated Jira project keys"),
    assignees: str = Query(..., description="Comma-separated Jira usernames"),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD"),
    adhoc_board: int | None = Query(default=None, description="Optional Ad-hoc board id"),
    service: WeeklyReportService = Depends(get_weekly_report_service),
):
    project_keys = [item.strip() for item in projects.split(",") if item.strip()]
    people = [item.strip() for item in assignees.split(",") if item.strip()]
    return await service.build_report(
        project_keys=project_keys,
        assignees=people,
        date_from=date_from,
        date_to=date_to,
        adhoc_board_id=adhoc_board,
    )
