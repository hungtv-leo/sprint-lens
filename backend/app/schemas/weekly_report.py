from __future__ import annotations

from pydantic import BaseModel, Field


class WeeklyBucketStat(BaseModel):
    bucket: str
    label: str
    total: int


class WeeklyAssigneeStat(BaseModel):
    assignee: str
    assignee_display_name: str
    total: int
    by_bucket: dict[str, int] = Field(default_factory=dict)


class WeeklyReportIssue(BaseModel):
    key: str
    summary: str
    status_name: str
    status_category: str
    bucket: str
    bucket_label: str
    source: str
    assignee_name: str | None = None
    assignee_display_name: str
    project_key: str
    sprint_names: list[str] = []
    updated: str | None = None
    url: str
    is_subtask: bool = False
    parent_key: str | None = None
    matched: bool = True


class WeeklyReportResponse(BaseModel):
    projects: list[str]
    date_from: str
    date_to: str
    assignees: list[str]
    adhoc_board_id: int | None = None
    adhoc_board_name: str | None = None
    total: int
    truncated: bool = False
    by_bucket: list[WeeklyBucketStat]
    by_assignee: list[WeeklyAssigneeStat]
    issues: list[WeeklyReportIssue]
    notes: list[str] = []
