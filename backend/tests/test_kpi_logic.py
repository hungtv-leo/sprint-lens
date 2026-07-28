from __future__ import annotations

import asyncio
import unittest
from io import BytesIO

from fastapi import HTTPException
from openpyxl import Workbook, load_workbook

from app.schemas.jira import IssuesResponse, JiraAssignee, JiraIssue
from app.schemas.kpi import (
    KpiAgentPayload,
    KpiCalculateResponse,
    KpiAgentResult,
    KpiCellUpdate,
    KpiPlanItem,
    KpiRequest,
    KpiPeriod,
    KpiStats,
)
from app.services.kpi_agent import compute_developer_kpi
from app.services.kpi_service import KpiService


class FakeJiraService:
    def __init__(self, responses: list[IssuesResponse]) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, object]] = []

    async def get_issues(
        self,
        project_keys: list[str],
        sprint: str | None = "active",
        assignee: str | None = None,
        query: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> IssuesResponse:
        self.calls.append(
            {
                "project_keys": project_keys,
                "sprint": sprint,
                "assignee": assignee,
                "query": query,
                "updated_from": updated_from,
                "updated_to": updated_to,
            }
        )
        return self.responses.pop(0)


class FakeAgentRunner:
    name = "fake-agent"

    async def run(self, payload: KpiAgentPayload) -> KpiAgentResult:
        return compute_developer_kpi(payload)


class KpiLogicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = KpiService(jira=None, agent=None)

    def make_issue(
        self,
        key: str,
        *,
        status_category: str = "done",
        status_name: str = "Done",
        assignee_name: str = "hung.tran",
        assignee_display_name: str = "Hưng",
        updated: str | None = "2026-07-09T10:00:00Z",
        due_date: str | None = None,
        story_points: float | None = None,
    ) -> JiraIssue:
        return JiraIssue(
            key=key,
            summary=f"Summary {key}",
            status_id="10000",
            status_name=status_name,
            status_category=status_category,
            priority="Medium",
            assignee=JiraAssignee(name=assignee_name, display_name=assignee_display_name),
            updated=updated,
            due_date=due_date,
            issue_type="Task",
            project_key="TI",
            project_name="TI",
            sprint_names=[],
            url=f"https://jira.local/browse/{key}",
            story_points=story_points,
        )

    def test_parse_plan_sheet_warns_when_due_date_out_of_month(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Kế hoạch Developer"
        worksheet["A2"] = "Mã Jira"
        worksheet["B2"] = "Tên công việc"
        worksheet["C2"] = "Loại kế hoạch"
        worksheet["D2"] = "Hạn dự kiến"
        worksheet["E2"] = "Điểm khối lượng"
        worksheet["A3"] = "TI-801"
        worksheet["B3"] = "Task A"
        worksheet["C3"] = "Cam kết"
        worksheet["D3"] = "2026-08-01"
        worksheet["E3"] = 3

        request = KpiRequest(
            role="developer",
            assignee="hung.tran",
            projects=["TI"],
            period=KpiPeriod(type="month", month="2026-07"),
        )

        _, _, validation_issues = self.service._parse_plan_sheet(workbook, request=request)
        codes = {item.code for item in validation_issues}
        self.assertIn("expected_due_date_out_of_month", codes)

    def test_parse_plan_sheet_accepts_wps_like_plan_type_text(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Kế hoạch Developer"
        worksheet["A2"] = "Mã Jira"
        worksheet["B2"] = "Tên công việc"
        worksheet["C2"] = "Loại kế hoạch"
        worksheet["A3"] = "TI-801"
        worksheet["B3"] = "Task A"
        worksheet["C3"] = "Cam k?t"

        plan_items, _, validation_issues = self.service._parse_plan_sheet(workbook)
        self.assertEqual(len(validation_issues), 0)
        self.assertEqual(plan_items[0].plan_type, "committed")

    def test_compute_developer_kpi_uses_plan_due_date_and_scope_score(self) -> None:
        payload = KpiAgentPayload(
            role="developer",
            period={"type": "month", "month": "2026-07"},
            assignee="hung.tran",
            projects=["TI"],
            plan_items=[
                KpiPlanItem(
                    row_number=3,
                    issue_key="TI-801",
                    task_title="Task A",
                    plan_type="committed",
                    expected_due_date="2026-07-10",
                    scope_score=3,
                )
            ],
            issues=[
                {
                    "key": "TI-801",
                    "summary": "Task A",
                    "status_category": "done",
                    "status_name": "Done",
                    "assignee_name": "hung.tran",
                    "assignee_display_name": "Hưng",
                    "due_date": None,
                    "updated": "2026-07-09T10:00:00Z",
                    "story_points": None,
                }
            ],
        )

        result = compute_developer_kpi(payload)
        self.assertEqual(result.stats.schedule_source, "plan_due_date")
        self.assertEqual(result.stats.throughput_source, "scope_score")
        self.assertEqual(result.stats.schedule_rate, 1.0)
        self.assertEqual(result.stats.throughput_rate, 1.0)
        self.assertTrue(any("nguồn=plan_due_date" in item for item in result.trace))

    def test_apply_cell_updates_formats_plain_number_cells(self) -> None:
        calculated = KpiCalculateResponse(
            role="developer",
            period=KpiPeriod(type="month", month="2026-07"),
            assignee="hung.tran",
            projects=["TI"],
            issue_count=1,
            result=KpiAgentResult(
                stats=KpiStats(
                    committed=1,
                    completed=1,
                    incomplete=0,
                    on_time_completed=1,
                    on_time_eligible=1,
                    commitment_rate=1.0,
                    schedule_rate=1.0,
                    throughput_rate=1.0,
                ),
                cell_updates=[
                    KpiCellUpdate(sheet="KPI Developer Demo", cell="H5", value=3),
                    KpiCellUpdate(sheet="KPI Developer Demo", cell="J5", value=1.0),
                ],
                trace=["Cam kết: 1/1 issue hoàn thành."],
            ),
            agent="local-skill",
        )

        content = self.service.apply_cell_updates(calculated)
        workbook = load_workbook(BytesIO(content))
        worksheet = workbook["KPI Developer Demo"]
        self.assertEqual(worksheet["H5"].number_format, "0.##")
        self.assertEqual(worksheet["H5"].value, 3)
        self.assertEqual(worksheet["J5"].value, 1.0)
        self.assertIn("Log tính KPI", workbook.sheetnames)
        log_sheet = workbook["Log tính KPI"]
        self.assertEqual(log_sheet["A1"].value, "Thông tin chung")

    def test_fetch_issues_requires_specific_sprint(self) -> None:
        request = KpiRequest(
            role="developer",
            assignee="hung.tran",
            projects=["TI"],
            period=KpiPeriod(type="sprint", sprint=None),
        )

        with self.assertRaises(HTTPException) as exc:
            asyncio.run(self.service._fetch_issues_response(request))
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("yêu cầu chọn một sprint cụ thể", exc.exception.detail)

    def test_calculate_marks_truncated_jira_as_blocking(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Kế hoạch Developer"
        worksheet["A2"] = "Mã Jira"
        worksheet["B2"] = "Tên công việc"
        worksheet["C2"] = "Loại kế hoạch"
        worksheet["A3"] = "TI-801"
        worksheet["B3"] = "Task A"
        worksheet["C3"] = "Cam kết"
        buffer = BytesIO()
        workbook.save(buffer)

        jira = FakeJiraService(
            [
                IssuesResponse(
                    issues=[self.make_issue("TI-801")],
                    total=1200,
                    returned=1,
                    truncated=True,
                ),
                IssuesResponse(
                    issues=[self.make_issue("TI-801")],
                    total=1,
                    returned=1,
                    truncated=False,
                ),
            ]
        )
        service = KpiService(jira=jira, agent=FakeAgentRunner())
        request = KpiRequest(
            role="developer",
            assignee="hung.tran",
            projects=["TI"],
            period=KpiPeriod(type="month", month="2026-07"),
        )

        calculated = asyncio.run(service.calculate(request, workbook_bytes=buffer.getvalue()))
        truncated_issues = [item for item in calculated.validation_issues if item.code == "jira_truncated"]
        self.assertTrue(calculated.dataset_truncated)
        self.assertEqual(len(truncated_issues), 1)
        self.assertTrue(truncated_issues[0].blocking)

    def test_calculate_excludes_done_issue_outside_month(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Kế hoạch Developer"
        worksheet["A2"] = "Mã Jira"
        worksheet["B2"] = "Tên công việc"
        worksheet["C2"] = "Loại kế hoạch"
        worksheet["D2"] = "Hạn dự kiến"
        worksheet["A3"] = "TI-801"
        worksheet["B3"] = "Task A"
        worksheet["C3"] = "Cam kết"
        worksheet["D3"] = "2026-07-10"
        buffer = BytesIO()
        workbook.save(buffer)

        jira = FakeJiraService(
            [
                IssuesResponse(
                    issues=[self.make_issue("TI-801", updated="2026-06-30T10:00:00Z")],
                    total=1,
                    returned=1,
                    truncated=False,
                ),
                IssuesResponse(
                    issues=[],
                    total=0,
                    returned=0,
                    truncated=False,
                ),
            ]
        )
        service = KpiService(jira=jira, agent=FakeAgentRunner())
        request = KpiRequest(
            role="developer",
            assignee="hung.tran",
            projects=["TI"],
            period=KpiPeriod(type="month", month="2026-07"),
        )

        calculated = asyncio.run(service.calculate(request, workbook_bytes=buffer.getvalue()))
        self.assertEqual(calculated.issue_count, 0)
        self.assertTrue(
            any(item.code == "outside_requested_month" for item in calculated.validation_issues)
        )

    def test_export_blocks_when_blocking_warnings_exist(self) -> None:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Kế hoạch Developer"
        worksheet["A2"] = "Mã Jira"
        worksheet["B2"] = "Tên công việc"
        worksheet["C2"] = "Loại kế hoạch"
        worksheet["A3"] = "TI-801"
        worksheet["B3"] = "Task A"
        worksheet["C3"] = "Cam kết"
        buffer = BytesIO()
        workbook.save(buffer)

        jira = FakeJiraService(
            [
                IssuesResponse(
                    issues=[],
                    total=0,
                    returned=0,
                    truncated=False,
                ),
                IssuesResponse(
                    issues=[],
                    total=0,
                    returned=0,
                    truncated=False,
                ),
            ]
        )
        service = KpiService(jira=jira, agent=FakeAgentRunner())
        request = KpiRequest(
            role="developer",
            assignee="hung.tran",
            projects=["TI"],
            period=KpiPeriod(type="month", month="2026-07"),
        )

        with self.assertRaises(HTTPException) as exc:
            asyncio.run(service.export(request, workbook_bytes=buffer.getvalue()))
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("Cần xử lý cảnh báo chặn", exc.exception.detail)


if __name__ == "__main__":
    unittest.main()
