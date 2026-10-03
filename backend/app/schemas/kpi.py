from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class KpiPeriod(BaseModel):
    type: Literal["sprint", "month"]
    sprint: str | None = None
    month: str | None = None


class KpiRequest(BaseModel):
    role: Literal["developer", "lead_developer"] = "developer"
    period: KpiPeriod
    assignee: str = Field(min_length=1)
    projects: list[str] = Field(min_length=1)


class KpiPlanItem(BaseModel):
    row_number: int
    issue_key: str
    task_title: str = ""
    plan_type: Literal["committed", "stretch", "out_of_scope"] = "committed"
    expected_due_date: str | None = None
    scope_score: float | None = None
    exclusion_reason: str | None = None


class KpiPlanValidationIssue(BaseModel):
    row_number: int | None = None
    issue_key: str | None = None
    level: Literal["error", "warning"] = "error"
    blocking: bool = False
    code: str
    message: str


class KpiPlanSummary(BaseModel):
    sheet_name: str
    total_rows: int = 0
    committed_rows: int = 0
    excluded_rows: int = 0
    duplicate_keys: int = 0
    missing_key_rows: int = 0
    invalid_rows: int = 0
    matched_issue_count: int = 0
    missing_in_jira_count: int = 0
    assignee_mismatch_count: int = 0
    unplanned_issue_count: int = 0


class KpiIssuePayload(BaseModel):
    key: str
    summary: str
    status_category: str
    status_name: str
    assignee_name: str | None = None
    assignee_display_name: str = "Chưa gán"
    due_date: str | None = None
    updated: str | None = None
    resolution_date: str | None = None
    status_category_change_date: str | None = None
    story_points: float | None = None


class KpiStats(BaseModel):
    committed: int
    completed: int
    incomplete: int
    on_time_completed: int
    on_time_eligible: int
    commitment_rate: float | None = None
    schedule_rate: float | None = None
    schedule_source: Literal["jira_due_date", "plan_due_date", "mixed", "none"] = "none"
    schedule_coverage: float | None = None
    throughput_rate: float | None = None
    throughput_source: Literal["story_points", "scope_score", "hybrid", "none"] = "none"
    throughput_coverage: float | None = None
    throughput_completed_scope: float | None = None
    throughput_committed_scope: float | None = None


class KpiCellUpdate(BaseModel):
    sheet: str
    cell: str
    value: float | int | str


class KpiEvidenceItem(BaseModel):
    key: str
    bucket: str
    note: str = ""


class KpiAgentResult(BaseModel):
    stats: KpiStats
    cell_updates: list[KpiCellUpdate]
    evidence: list[KpiEvidenceItem] = []
    notes: list[str] = []
    trace: list[str] = []


class KpiCalculateResponse(BaseModel):
    role: str
    period: KpiPeriod
    assignee: str
    projects: list[str]
    issue_count: int
    dataset_truncated: bool = False
    plan_summary: KpiPlanSummary | None = None
    validation_issues: list[KpiPlanValidationIssue] = []
    result: KpiAgentResult
    agent: str


class KpiAgentPayload(BaseModel):
    role: str
    period: dict[str, Any]
    assignee: str
    projects: list[str]
    plan_items: list[KpiPlanItem] = []
    issues: list[KpiIssuePayload]
