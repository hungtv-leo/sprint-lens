from __future__ import annotations

from calendar import monthrange
from datetime import date
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from openpyxl import load_workbook

from app.schemas.jira import JiraIssue
from app.schemas.kpi import (
    KpiAgentPayload,
    KpiAgentResult,
    KpiCalculateResponse,
    KpiIssuePayload,
    KpiRequest,
)
from app.services.jira_service import JiraService
from app.services.kpi_agent import KpiAgentRunner, SHEET_DEVELOPER


def template_path() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "kpi" / "kpi-template.xlsx"


class KpiService:
    def __init__(self, jira: JiraService, agent: KpiAgentRunner) -> None:
        self.jira = jira
        self.agent = agent

    async def _fetch_issues(self, request: KpiRequest) -> list[JiraIssue]:
        projects = [item.strip() for item in request.projects if item.strip()]
        if not projects:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project.")

        if request.period.type == "sprint":
            sprint = request.period.sprint or None
            return await self.jira.get_issues(
                projects,
                sprint=sprint,
                assignee=request.assignee,
            )

        if request.period.type == "month":
            month = request.period.month
            if not month or len(month) != 7 or month[4] != "-":
                raise HTTPException(status_code=400, detail="month phải có dạng YYYY-MM.")
            year_s, month_s = month.split("-")
            try:
                year, month_num = int(year_s), int(month_s)
                start = date(year, month_num, 1)
                end = date(year, month_num, monthrange(year, month_num)[1])
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="month không hợp lệ.") from exc

            return await self.jira.get_issues(
                projects,
                sprint=None,
                assignee=request.assignee,
                updated_from=start.isoformat(),
                updated_to=end.isoformat(),
            )

        raise HTTPException(status_code=400, detail="period.type không hợp lệ.")

    def _to_payload(self, request: KpiRequest, issues: list[JiraIssue]) -> KpiAgentPayload:
        return KpiAgentPayload(
            role=request.role,
            period=request.period.model_dump(),
            assignee=request.assignee,
            projects=request.projects,
            issues=[
                KpiIssuePayload(
                    key=issue.key,
                    summary=issue.summary,
                    status_category=issue.status_category,
                    status_name=issue.status_name,
                    due_date=issue.due_date,
                    updated=issue.updated,
                    story_points=getattr(issue, "story_points", None),
                )
                for issue in issues
            ],
        )

    async def calculate(self, request: KpiRequest) -> KpiCalculateResponse:
        issues = await self._fetch_issues(request)
        payload = self._to_payload(request, issues)
        result = await self.agent.run(payload)
        return KpiCalculateResponse(
            role=request.role,
            period=request.period,
            assignee=request.assignee,
            projects=request.projects,
            issue_count=len(issues),
            result=result,
            agent=self.agent.name,
        )

    def apply_cell_updates(self, result: KpiAgentResult) -> bytes:
        path = template_path()
        if not path.is_file():
            raise HTTPException(status_code=500, detail=f"Thiếu template KPI: {path}")

        workbook = load_workbook(path)
        for update in result.cell_updates:
            sheet_name = update.sheet or SHEET_DEVELOPER
            if sheet_name not in workbook.sheetnames:
                raise HTTPException(
                    status_code=500,
                    detail=f"Sheet không tồn tại trong template: {sheet_name}",
                )
            workbook[sheet_name][update.cell] = update.value

        buffer = BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()

    async def export(self, request: KpiRequest) -> tuple[bytes, KpiCalculateResponse]:
        calculated = await self.calculate(request)
        content = self.apply_cell_updates(calculated.result)
        return content, calculated
