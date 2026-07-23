from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class KpiPeriod(BaseModel):
    type: Literal["sprint", "month"]
    sprint: str | None = None
    month: str | None = None


class KpiRequest(BaseModel):
    role: Literal["developer"] = "developer"
    period: KpiPeriod
    assignee: str = Field(min_length=1)
    projects: list[str] = Field(min_length=1)


class KpiIssuePayload(BaseModel):
    key: str
    summary: str
    status_category: str
    status_name: str
    due_date: str | None = None
    updated: str | None = None
    story_points: float | None = None


class KpiStats(BaseModel):
    committed: int
    completed: int
    incomplete: int
    on_time_completed: int
    on_time_eligible: int
    commitment_rate: float
    schedule_rate: float | None = None
    throughput_rate: float | None = None


class KpiCellUpdate(BaseModel):
    sheet: str
    cell: str
    value: float | str


class KpiEvidenceItem(BaseModel):
    key: str
    bucket: str
    note: str = ""


class KpiAgentResult(BaseModel):
    stats: KpiStats
    cell_updates: list[KpiCellUpdate]
    evidence: list[KpiEvidenceItem] = []
    notes: list[str] = []


class KpiCalculateResponse(BaseModel):
    role: str
    period: KpiPeriod
    assignee: str
    projects: list[str]
    issue_count: int
    result: KpiAgentResult
    agent: str


class KpiAgentPayload(BaseModel):
    role: str
    period: dict[str, Any]
    assignee: str
    projects: list[str]
    issues: list[KpiIssuePayload]
