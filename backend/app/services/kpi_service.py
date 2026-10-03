from __future__ import annotations

import re
import unicodedata
from calendar import monthrange
from datetime import date, datetime
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from openpyxl import load_workbook
from openpyxl.styles import Font
from openpyxl.workbook import Workbook

from app.schemas.jira import IssuesResponse, JiraIssue
from app.schemas.kpi import (
    KpiAgentPayload,
    KpiCalculateResponse,
    KpiIssuePayload,
    KpiPlanItem,
    KpiPlanSummary,
    KpiPlanValidationIssue,
    KpiRequest,
)
from app.services.jira_service import JiraService
from app.services.kpi_agent import KpiAgentRunner, completion_date_of, sheet_for_role

PLAN_SHEET_DEVELOPER = "Kế hoạch Developer"
PLAN_SHEET_DEVELOPER_LEGACY = "Developer Plan"
PLAN_HEADER_ROW = 2
PLAN_HEADER_ALIASES = {
    "jira issue key": "issue_key",
    "ma jira": "issue_key",
    "task title": "task_title",
    "ten cong viec": "task_title",
    "plan type": "plan_type",
    "loai ke hoach": "plan_type",
    "expected due date": "expected_due_date",
    "han du kien": "expected_due_date",
    "scope score": "scope_score",
    "điem khoi luong": "scope_score",
    "notes / exclusion reason": "exclusion_reason",
    "ghi chu / ly do loai tru": "exclusion_reason",
}
ISSUE_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]+-\d+$")
PLAIN_NUMBER_CELLS = {"H5", "I5", "H6", "I6", "H7", "I7", "L5", "M5", "L6", "M6", "L7", "M7"}
# Employee cols H–K → manager cols L–O (same metrics; CBQL reviews later).
EMPLOYEE_TO_MANAGER_COLS = (("H", "L"), ("I", "M"), ("J", "N"), ("K", "O"))
EXPORT_COMMON_SHEETS = {
    PLAN_SHEET_DEVELOPER,
    "Log tính KPI",
}
WARNING_CODE_LABELS = {
    "jira_truncated": "Dữ liệu Jira bị cắt ngưỡng",
    "missing_in_jira": "Thiếu trên Jira",
    "assignee_mismatch": "Không khớp người được giao",
    "assignee_mismatch_summary": "Tóm tắt người được giao",
    "unplanned_issue": "Ngoài kế hoạch",
    "outside_requested_month": "Ngoài tháng đang tính",
    "expected_due_date_out_of_month": "Hạn dự kiến lệch tháng",
}
EVIDENCE_BUCKET_LABELS = {
    "completed": "Hoàn thành",
    "incomplete": "Chưa hoàn thành",
    "excluded": "Loại trừ",
    "missing_jira": "Thiếu trên Jira",
    "on_time": "Đúng hạn",
    "late": "Trễ hạn",
}


def template_path() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "kpi" / "kpi-template-vn.xlsx"


def plan_template_path() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "kpi" / "kpi-plan-developer.xlsx"


class KpiService:
    def __init__(self, jira: JiraService, agent: KpiAgentRunner) -> None:
        self.jira = jira
        self.agent = agent

    def _month_bounds(self, month: str) -> tuple[date, date]:
        if len(month) != 7 or month[4] != "-":
            raise HTTPException(status_code=400, detail="month phải có dạng YYYY-MM.")
        year_s, month_s = month.split("-")
        try:
            year, month_num = int(year_s), int(month_s)
            start = date(year, month_num, 1)
            end = date(year, month_num, monthrange(year, month_num)[1])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="month không hợp lệ.") from exc
        return start, end

    def _parse_issue_date(self, value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None

    def _is_subtask_issue(self, issue: JiraIssue) -> bool:
        if issue.is_subtask:
            return True
        issue_type = (issue.issue_type or "").strip().lower()
        return issue_type in {"sub-task", "subtask", "nhiệm vụ phụ", "sub task"}

    def _is_in_progress_issue(self, issue: JiraIssue) -> bool:
        status_name = " ".join((issue.status_name or "").strip().lower().split())
        return status_name in {
            "in progress",
            "in-progress",
            "đang làm",
            "dang lam",
            "đang thực hiện",
            "dang thuc hien",
        }

    def _parse_flexible_date(self, value: object) -> date | None:
        """Parse plan due dates from Excel (datetime) or common text formats."""
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value

        text = str(value).strip()
        if not text:
            return None

        # Excel sometimes stringifies datetime with time.
        if " " in text:
            text = text.split(" ", 1)[0]
        if "T" in text:
            text = text.split("T", 1)[0]

        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue

        for fmt in ("%d-%m-%y", "%d/%m/%y", "%d.%m.%y"):
            try:
                parsed = datetime.strptime(text, fmt).date()
                # Keep KPI years in the 2000s for 2-digit years.
                if parsed.year < 2000:
                    parsed = parsed.replace(year=parsed.year + 100)
                return parsed
            except ValueError:
                continue

        return None

    async def _fetch_issues_response(self, request: KpiRequest) -> IssuesResponse:
        projects = [item.strip() for item in request.projects if item.strip()]
        if not projects:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project.")

        if request.period.type == "sprint":
            sprint = request.period.sprint or None
            if not sprint:
                raise HTTPException(status_code=400, detail="Chế độ sprint yêu cầu chọn một sprint cụ thể.")
            return await self.jira.get_issues(
                projects,
                sprint=sprint,
                assignee=request.assignee,
            )

        if request.period.type == "month":
            month = request.period.month
            if not month:
                raise HTTPException(status_code=400, detail="month phải có dạng YYYY-MM.")
            start, end = self._month_bounds(month)

            return await self.jira.get_issues(
                projects,
                sprint=None,
                assignee=request.assignee,
                updated_from=start.isoformat(),
                updated_to=end.isoformat(),
            )

        raise HTTPException(status_code=400, detail="period.type không hợp lệ.")

    def _normalize_header(self, value: object) -> str:
        text = " ".join(str(value or "").strip().lower().split())
        normalized = unicodedata.normalize("NFKD", text)
        return "".join(ch for ch in normalized if not unicodedata.combining(ch))

    def _normalize_assignee_value(self, value: str | None) -> str:
        return "".join(ch.lower() for ch in (value or "").strip() if ch.isalnum())

    def _normalize_plan_type(self, value: object) -> str:
        text = " ".join(str(value or "").strip().lower().split())
        normalized = unicodedata.normalize("NFKD", text)
        normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
        return " ".join(normalized.split())

    def _map_plan_type(self, value: object) -> str | None:
        normalized = self._normalize_plan_type(value)
        if not normalized:
            return "committed"
        if normalized in {"committed", "cam ket"} or normalized.startswith("cam k"):
            return "committed"
        if normalized in {"stretch", "phat sinh"} or normalized.startswith("phat s"):
            return "stretch"
        if normalized in {"out of scope", "out of scope", "out_of_scope", "ngoai pham vi"}:
            return "out_of_scope"
        if normalized.startswith("ngoai ph") or normalized.startswith("out of"):
            return "out_of_scope"
        return None

    def _load_workbook(self, workbook_bytes: bytes | None) -> Workbook:
        if workbook_bytes:
            return load_workbook(BytesIO(workbook_bytes))
        path = template_path()
        if not path.is_file():
            raise HTTPException(status_code=500, detail=f"Thiếu template KPI: {path}")
        return load_workbook(path)

    def _copy_plan_sheet(self, source: Workbook, target: Workbook) -> None:
        source_sheet_name = (
            PLAN_SHEET_DEVELOPER
            if PLAN_SHEET_DEVELOPER in source.sheetnames
            else PLAN_SHEET_DEVELOPER_LEGACY
        )
        if source_sheet_name not in source.sheetnames:
            return

        if PLAN_SHEET_DEVELOPER in target.sheetnames:
            worksheet = target[PLAN_SHEET_DEVELOPER]
            for row in worksheet.iter_rows():
                for cell in row:
                    cell.value = None
        else:
            worksheet = target.create_sheet(PLAN_SHEET_DEVELOPER)

        source_sheet = source[source_sheet_name]
        for row in source_sheet.iter_rows():
            for cell in row:
                worksheet[cell.coordinate] = cell.value
        worksheet.freeze_panes = source_sheet.freeze_panes

    def _export_sheets_to_keep(self, role: str) -> set[str]:
        return {sheet_for_role(role), *EXPORT_COMMON_SHEETS}

    def _prune_export_sheets(self, workbook: Workbook, role: str) -> None:
        """Keep only the role KPI sheet, plan, criteria, and calculation log."""
        keep = {name for name in self._export_sheets_to_keep(role) if name in workbook.sheetnames}
        if not keep:
            return
        for sheet_name in list(workbook.sheetnames):
            if sheet_name not in keep:
                del workbook[sheet_name]

    @staticmethod
    def _is_excel_formula(value: object) -> bool:
        return isinstance(value, str) and value.startswith("=")

    def _mirror_employee_scores_to_manager(self, workbook: Workbook, role: str) -> None:
        """Seed CBQL columns from employee scores so manager starts from the same numbers."""
        sheet_name = sheet_for_role(role)
        if sheet_name not in workbook.sheetnames:
            return
        worksheet = workbook[sheet_name]
        # Skip header labels (rows 1–2); keep structural formulas on either side intact.
        for row in range(3, worksheet.max_row + 1):
            for employee_col, manager_col in EMPLOYEE_TO_MANAGER_COLS:
                employee_cell = worksheet[f"{employee_col}{row}"]
                manager_cell = worksheet[f"{manager_col}{row}"]
                if self._is_excel_formula(employee_cell.value) or self._is_excel_formula(manager_cell.value):
                    continue
                if employee_cell.value is None and manager_cell.value is None:
                    continue
                manager_cell.value = employee_cell.value
                if employee_cell.number_format:
                    manager_cell.number_format = employee_cell.number_format

    def _write_log_sheet(self, workbook: Workbook, calculated: KpiCalculateResponse) -> None:
        sheet_name = "Log tính KPI"
        if sheet_name in workbook.sheetnames:
            worksheet = workbook[sheet_name]
            for row in worksheet.iter_rows():
                for cell in row:
                    cell.value = None
        else:
            worksheet = workbook.create_sheet(sheet_name)

        row = 1

        def write_section(title: str) -> None:
            nonlocal row
            worksheet.cell(row, 1).value = title
            worksheet.cell(row, 1).font = Font(bold=True)
            row += 1

        def write_kv(key: str, value: object) -> None:
            nonlocal row
            worksheet.cell(row, 1).value = key
            worksheet.cell(row, 2).value = value
            row += 1

        write_section("Thông tin chung")
        write_kv("Vai trò", calculated.role)
        write_kv("Nhân viên", calculated.assignee)
        write_kv("Kỳ đánh giá", calculated.period.month or calculated.period.sprint or calculated.period.type)
        write_kv("Dự án", ", ".join(calculated.projects))
        write_kv("Bộ máy tính", calculated.agent)
        write_kv("Dữ liệu Jira bị cắt ngưỡng", "Có" if calculated.dataset_truncated else "Không")
        row += 1

        write_section("Tóm tắt kế hoạch")
        if calculated.plan_summary:
            write_kv("Sheet kế hoạch", calculated.plan_summary.sheet_name)
            write_kv("Dòng kế hoạch", calculated.plan_summary.total_rows)
            write_kv("Cam kết", calculated.plan_summary.committed_rows)
            write_kv("Khớp trên Jira", calculated.plan_summary.matched_issue_count)
            write_kv("Thiếu trên Jira", calculated.plan_summary.missing_in_jira_count)
            write_kv("Không khớp người được giao", calculated.plan_summary.assignee_mismatch_count)
            write_kv("Ngoài kế hoạch", calculated.plan_summary.unplanned_issue_count)
        else:
            write_kv("Sheet kế hoạch", "Không có")
        row += 1

        stats = calculated.result.stats
        write_section("Chỉ số KPI")
        write_kv("Tỷ lệ cam kết", stats.commitment_rate)
        write_kv("Đúng hạn", stats.schedule_rate if stats.schedule_rate is not None else "x")
        write_kv("Nguồn đúng hạn", stats.schedule_source)
        write_kv("Coverage đúng hạn", stats.schedule_coverage if stats.schedule_coverage is not None else "x")
        write_kv("Thông lượng", stats.throughput_rate if stats.throughput_rate is not None else "x")
        write_kv("Nguồn thông lượng", stats.throughput_source)
        write_kv(
            "Coverage thông lượng",
            stats.throughput_coverage if stats.throughput_coverage is not None else "x",
        )
        write_kv("Khối lượng hoàn thành", stats.throughput_completed_scope or 0)
        write_kv("Khối lượng cam kết", stats.throughput_committed_scope or 0)
        row += 1

        write_section("Dấu vết tính toán")
        if calculated.result.trace:
            for item in calculated.result.trace:
                worksheet.cell(row, 1).value = item
                row += 1
        else:
            worksheet.cell(row, 1).value = "Không có"
            row += 1
        row += 1

        write_section("Cảnh báo")
        if calculated.validation_issues:
            worksheet.cell(row, 1).value = "Mã"
            worksheet.cell(row, 2).value = "Dòng"
            worksheet.cell(row, 3).value = "Issue"
            worksheet.cell(row, 4).value = "Mức độ"
            worksheet.cell(row, 5).value = "Nội dung"
            for col in range(1, 6):
                worksheet.cell(row, col).font = Font(bold=True)
            row += 1
            for item in calculated.validation_issues:
                level_text = "Chặn export" if item.blocking else "Chỉ nhắc"
                worksheet.cell(row, 1).value = WARNING_CODE_LABELS.get(item.code, item.code)
                worksheet.cell(row, 2).value = item.row_number
                worksheet.cell(row, 3).value = item.issue_key
                worksheet.cell(row, 4).value = level_text
                worksheet.cell(row, 5).value = item.message
                row += 1
        else:
            worksheet.cell(row, 1).value = "Không có"
            row += 1
        row += 1

        write_section("Bằng chứng")
        worksheet.cell(row, 1).value = "Issue"
        worksheet.cell(row, 2).value = "Nhóm"
        worksheet.cell(row, 3).value = "Ghi chú"
        for col in range(1, 4):
            worksheet.cell(row, col).font = Font(bold=True)
        row += 1
        for item in calculated.result.evidence:
            worksheet.cell(row, 1).value = item.key
            worksheet.cell(row, 2).value = EVIDENCE_BUCKET_LABELS.get(item.bucket, item.bucket)
            worksheet.cell(row, 3).value = item.note
            row += 1

        worksheet.freeze_panes = "A2"
        worksheet.column_dimensions["A"].width = 28
        worksheet.column_dimensions["B"].width = 22
        worksheet.column_dimensions["C"].width = 22
        worksheet.column_dimensions["D"].width = 14
        worksheet.column_dimensions["E"].width = 72

    def _parse_plan_sheet(
        self,
        workbook: Workbook,
        request: KpiRequest | None = None,
    ) -> tuple[list[KpiPlanItem], KpiPlanSummary, list[KpiPlanValidationIssue]]:
        sheet_name = PLAN_SHEET_DEVELOPER
        if sheet_name not in workbook.sheetnames and PLAN_SHEET_DEVELOPER_LEGACY in workbook.sheetnames:
            sheet_name = PLAN_SHEET_DEVELOPER_LEGACY

        if sheet_name not in workbook.sheetnames:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Thiếu sheet kế hoạch `{PLAN_SHEET_DEVELOPER}` "
                    f"(hoặc sheet cũ `{PLAN_SHEET_DEVELOPER_LEGACY}`) trong file KPI."
                ),
            )

        worksheet = workbook[sheet_name]
        header_map: dict[str, int] = {}
        for col in range(1, worksheet.max_column + 1):
            normalized = self._normalize_header(worksheet.cell(PLAN_HEADER_ROW, col).value)
            field_name = PLAN_HEADER_ALIASES.get(normalized)
            if field_name:
                header_map[field_name] = col

        required_headers = ("issue_key", "task_title", "plan_type")
        missing_headers = [name for name in required_headers if name not in header_map]
        if missing_headers:
            raise HTTPException(
                status_code=400,
                detail="Thiếu cột bắt buộc trong sheet Developer Plan: " + ", ".join(missing_headers),
            )

        plan_items: list[KpiPlanItem] = []
        validation_issues: list[KpiPlanValidationIssue] = []
        seen_keys: dict[str, int] = {}
        total_rows = 0
        committed_rows = 0
        excluded_rows = 0

        for row in range(PLAN_HEADER_ROW + 1, worksheet.max_row + 1):
            issue_key = str(worksheet.cell(row, header_map["issue_key"]).value or "").strip()
            task_title = str(worksheet.cell(row, header_map["task_title"]).value or "").strip()
            raw_plan_type_value = worksheet.cell(row, header_map["plan_type"]).value
            plan_type_raw = self._normalize_plan_type(raw_plan_type_value)
            due_raw = (
                worksheet.cell(row, header_map["expected_due_date"]).value
                if "expected_due_date" in header_map
                else None
            )
            due_text = "" if due_raw is None else str(due_raw).strip()
            scope_text = (
                worksheet.cell(row, header_map["scope_score"]).value
                if "scope_score" in header_map
                else None
            )
            exclusion_reason = (
                str(worksheet.cell(row, header_map["exclusion_reason"]).value or "").strip()
                if "exclusion_reason" in header_map
                else ""
            )

            row_has_content = any(
                [
                    issue_key,
                    task_title,
                    plan_type_raw,
                    due_text,
                    "" if scope_text is None else str(scope_text).strip(),
                    exclusion_reason,
                ]
            )
            if not row_has_content:
                continue

            total_rows += 1

            if not issue_key:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row,
                        code="missing_issue_key",
                        message="Thiếu Jira Issue Key.",
                    )
                )
                continue

            normalized_key = issue_key.upper()
            if not ISSUE_KEY_RE.fullmatch(normalized_key):
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row,
                        issue_key=normalized_key,
                        code="invalid_issue_key",
                        message="Jira Issue Key không đúng định dạng, ví dụ TI-123.",
                    )
                )
                continue

            plan_type = self._map_plan_type(raw_plan_type_value)
            if plan_type is None:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row,
                        issue_key=normalized_key,
                        code="invalid_plan_type",
                        message="Loại kế hoạch phải là Cam kết, Phát sinh hoặc Ngoài phạm vi.",
                    )
                )
                continue

            if normalized_key in seen_keys:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row,
                        issue_key=normalized_key,
                        code="duplicate_issue_key",
                        message=f"Trùng với dòng {seen_keys[normalized_key]}.",
                    )
                )
                continue

            expected_due_date: str | None = None
            if due_raw not in (None, ""):
                parsed_due = self._parse_flexible_date(due_raw)
                if parsed_due is None:
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            row_number=row,
                            issue_key=normalized_key,
                            code="invalid_expected_due_date",
                            message=(
                                "Hạn dự kiến không hợp lệ. "
                                "Hỗ trợ: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY."
                            ),
                        )
                    )
                    continue
                expected_due_date = parsed_due.isoformat()
                if request and request.period.type == "month" and request.period.month:
                    month_start, month_end = self._month_bounds(request.period.month)
                    if not (month_start <= parsed_due <= month_end):
                        validation_issues.append(
                            KpiPlanValidationIssue(
                                row_number=row,
                                issue_key=normalized_key,
                                level="warning",
                                code="expected_due_date_out_of_month",
                                message=f"Hạn dự kiến không nằm trong tháng {request.period.month}.",
                            )
                        )

            scope_score: float | None = None
            if scope_text not in (None, ""):
                try:
                    scope_score = float(scope_text)
                except (TypeError, ValueError):
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            row_number=row,
                            issue_key=normalized_key,
                            code="invalid_scope_score",
                            message="Scope score phải là số.",
                        )
                    )
                    continue
                if scope_score < 0:
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            row_number=row,
                            issue_key=normalized_key,
                            code="negative_scope_score",
                            message="Điểm khối lượng không được âm.",
                        )
                    )
                    continue
                if scope_score > 100:
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            row_number=row,
                            issue_key=normalized_key,
                            level="warning",
                            code="scope_score_too_large",
                            message="Điểm khối lượng lớn bất thường, hãy kiểm tra lại.",
                        )
                    )

            if not task_title:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row,
                        issue_key=normalized_key,
                        level="warning",
                        code="missing_task_title",
                        message="Nên điền Tên công việc để dễ đối chiếu.",
                    )
                )

            seen_keys[normalized_key] = row
            if plan_type == "committed":
                committed_rows += 1
            else:
                excluded_rows += 1

            plan_items.append(
                KpiPlanItem(
                    row_number=row,
                    issue_key=normalized_key,
                    task_title=task_title,
                    plan_type=plan_type,
                    expected_due_date=expected_due_date,
                    scope_score=scope_score,
                    exclusion_reason=exclusion_reason or None,
                )
            )

        summary = KpiPlanSummary(
            sheet_name=sheet_name,
            total_rows=total_rows,
            committed_rows=committed_rows,
            excluded_rows=excluded_rows,
            duplicate_keys=sum(1 for item in validation_issues if item.code == "duplicate_issue_key"),
            missing_key_rows=sum(1 for item in validation_issues if item.code == "missing_issue_key"),
            invalid_rows=sum(1 for item in validation_issues if item.level == "error"),
        )
        return plan_items, summary, validation_issues

    def _to_payload(
        self,
        request: KpiRequest,
        issues: list[JiraIssue],
        plan_items: list[KpiPlanItem] | None = None,
    ) -> KpiAgentPayload:
        return KpiAgentPayload(
            role=request.role,
            period=request.period.model_dump(),
            assignee=request.assignee,
            projects=request.projects,
            plan_items=plan_items or [],
            issues=[
                KpiIssuePayload(
                    key=issue.key,
                    summary=issue.summary,
                    status_category=issue.status_category,
                    status_name=issue.status_name,
                    assignee_name=issue.assignee.name,
                    assignee_display_name=issue.assignee.display_name,
                    due_date=issue.due_date,
                    updated=issue.updated,
                    resolution_date=getattr(issue, "resolution_date", None),
                    status_category_change_date=getattr(issue, "status_category_change_date", None),
                    story_points=getattr(issue, "story_points", None),
                )
                for issue in issues
            ],
        )

    async def calculate(
        self,
        request: KpiRequest,
        workbook_bytes: bytes | None = None,
    ) -> KpiCalculateResponse:
        validation_issues: list[KpiPlanValidationIssue] = []
        plan_summary: KpiPlanSummary | None = None
        plan_items: list[KpiPlanItem] = []
        issues: list[JiraIssue]
        dataset_truncated = False

        if workbook_bytes:
            workbook = self._load_workbook(workbook_bytes)
            plan_items, plan_summary, validation_issues = self._parse_plan_sheet(workbook, request=request)
            blocking_errors = [item for item in validation_issues if item.level == "error"]
            if blocking_errors:
                detail = "\n".join(
                    f"Dòng {item.row_number}: {item.message}" if item.row_number else item.message
                    for item in blocking_errors[:12]
                )
                raise HTTPException(status_code=400, detail=detail)

            if not plan_items:
                raise HTTPException(
                    status_code=400,
                    detail="File kế hoạch không có dòng hợp lệ để tính KPI.",
                )
            if not any(item.plan_type == "committed" for item in plan_items):
                raise HTTPException(
                    status_code=400,
                    detail="File kế hoạch không có task Cam kết hợp lệ để tính KPI.",
                )

            issue_keys = [item.issue_key for item in plan_items]
            issue_response = await self.jira.get_issues(
                request.projects,
                sprint=None,
                assignee=None,
                query=f"__keys__:{' OR '.join(f'key = \"{key}\"' for key in issue_keys)}",
            )
            issues = issue_response.issues
            period_response = await self._fetch_issues_response(request)
            period_issues = period_response.issues
            dataset_truncated = issue_response.truncated or period_response.truncated
            if dataset_truncated:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        level="warning",
                        blocking=True,
                        code="jira_truncated",
                        message="Dữ liệu Jira vượt ngưỡng lấy tối đa, kết quả có thể chưa đầy đủ.",
                    )
                )

            planned_key_set = {item.issue_key for item in plan_items}
            found_key_set = {issue.key.upper() for issue in issues}

            missing_in_jira = sorted(planned_key_set - found_key_set)
            for key in missing_in_jira:
                row_number = next(
                    (item.row_number for item in plan_items if item.issue_key == key),
                    None,
                )
                validation_issues.append(
                    KpiPlanValidationIssue(
                        row_number=row_number,
                        issue_key=key,
                        level="warning",
                        blocking=True,
                        code="missing_in_jira",
                        message="Không tìm thấy issue trên Jira theo key / project đã chọn.",
                    )
                )

            if request.period.type == "month" and request.period.month:
                month_start, month_end = self._month_bounds(request.period.month)
                for issue in issues:
                    if issue.status_category == "done":
                        activity_on, activity_source = completion_date_of(issue)
                        activity_label = "hoàn thành"
                    else:
                        activity_on = self._parse_issue_date(issue.updated)
                        activity_source = "updated"
                        activity_label = "cập nhật"
                    if activity_on and month_start <= activity_on <= month_end:
                        continue
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            issue_key=issue.key,
                            level="warning",
                            blocking=False,
                            code="outside_requested_month",
                            message=(
                                f"Issue không có {activity_label} thuộc tháng đang tính "
                                f"(nguồn={activity_source}). Vẫn giữ trong mẫu số KPI tháng để tránh lệch số liệu."
                            ),
                        )
                    )

            assignee_mismatches = 0
            for issue in issues:
                requested_assignee = self._normalize_assignee_value(request.assignee)
                issue_assignees = {
                    self._normalize_assignee_value(issue.assignee.display_name),
                    self._normalize_assignee_value(issue.assignee.name),
                }
                if requested_assignee and requested_assignee not in issue_assignees:
                    assignee_mismatches += 1
                    validation_issues.append(
                        KpiPlanValidationIssue(
                            issue_key=issue.key,
                            level="warning",
                            blocking=True,
                            code="assignee_mismatch",
                            message=(
                                f"Issue đang gán cho {issue.assignee.display_name}, không khớp người đã chọn."
                            ),
                        )
                    )

            unplanned_issues = [
                issue
                for issue in period_issues
                if issue.key.upper() not in planned_key_set
                and not self._is_subtask_issue(issue)
                and self._is_in_progress_issue(issue)
            ]
            for issue in unplanned_issues:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        issue_key=issue.key,
                        level="warning",
                        blocking=False,
                        code="unplanned_issue",
                        message="Đang In Progress trên Jira nhưng không có trong kế hoạch tháng.",
                    )
                )

            plan_summary.matched_issue_count = len(found_key_set)
            plan_summary.missing_in_jira_count = len(missing_in_jira)
            plan_summary.assignee_mismatch_count = assignee_mismatches
            plan_summary.unplanned_issue_count = len(unplanned_issues)

            if assignee_mismatches:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        level="warning",
                        blocking=True,
                        code="assignee_mismatch_summary",
                        message=f"Có {assignee_mismatches} issue không còn assign cho nhân viên đã chọn.",
                    )
                )
        else:
            issue_response = await self._fetch_issues_response(request)
            issues = issue_response.issues
            dataset_truncated = issue_response.truncated
            if dataset_truncated:
                validation_issues.append(
                    KpiPlanValidationIssue(
                        level="warning",
                        blocking=True,
                        code="jira_truncated",
                        message="Dữ liệu Jira vượt ngưỡng lấy tối đa, kết quả có thể chưa đầy đủ.",
                    )
                )

        payload = self._to_payload(request, issues, plan_items=plan_items)
        result = await self.agent.run(payload)
        return KpiCalculateResponse(
            role=request.role,
            period=request.period,
            assignee=request.assignee,
            projects=request.projects,
            issue_count=len(issues),
            dataset_truncated=dataset_truncated,
            plan_summary=plan_summary,
            validation_issues=validation_issues,
            result=result,
            agent=self.agent.name,
        )

    def apply_cell_updates(
        self,
        calculated: KpiCalculateResponse,
        workbook_bytes: bytes | None = None,
    ) -> bytes:
        workbook = self._load_workbook(None)
        if workbook_bytes:
            self._copy_plan_sheet(self._load_workbook(workbook_bytes), workbook)
        for update in calculated.result.cell_updates:
            sheet_name = update.sheet or sheet_for_role(calculated.role)
            if sheet_name not in workbook.sheetnames:
                raise HTTPException(
                    status_code=500,
                    detail=f"Sheet không tồn tại trong template: {sheet_name}",
                )
            cell = workbook[sheet_name][update.cell]
            cell.value = update.value
            if update.cell in PLAIN_NUMBER_CELLS and isinstance(update.value, (int, float)):
                cell.number_format = "0.##"

        self._mirror_employee_scores_to_manager(workbook, calculated.role)
        self._write_log_sheet(workbook, calculated)
        self._prune_export_sheets(workbook, calculated.role)

        buffer = BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()

    async def export(
        self,
        request: KpiRequest,
        workbook_bytes: bytes | None = None,
    ) -> tuple[bytes, KpiCalculateResponse]:
        calculated = await self.calculate(request, workbook_bytes=workbook_bytes)
        blocking_issues = [item for item in calculated.validation_issues if item.blocking]
        if blocking_issues:
            detail = "\n".join(item.message for item in blocking_issues[:10])
            raise HTTPException(status_code=400, detail=f"Cần xử lý cảnh báo chặn trước khi export:\n{detail}")
        content = self.apply_cell_updates(calculated, workbook_bytes=workbook_bytes)
        return content, calculated
