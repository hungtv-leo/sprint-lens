from __future__ import annotations

from pydantic import BaseModel, Field


class JiraProject(BaseModel):
    key: str
    name: str
    project_type: str | None = Field(default=None, alias="projectTypeKey")


class JiraStatus(BaseModel):
    id: str
    name: str
    category_key: str
    category_name: str


class JiraSprint(BaseModel):
    id: int
    name: str
    state: str
    goal: str | None = None
    start_date: str | None = Field(default=None, alias="startDate")
    end_date: str | None = Field(default=None, alias="endDate")


class JiraAssignee(BaseModel):
    display_name: str = "Chưa gán"
    avatar_url: str | None = None


class JiraUser(BaseModel):
    name: str | None = None
    key: str | None = None
    account_id: str | None = None
    display_name: str
    email: str | None = None
    avatar_url: str | None = None
    active: bool = True


class JiraIssue(BaseModel):
    key: str
    summary: str
    status_id: str
    status_name: str
    status_category: str
    priority: str | None = None
    assignee: JiraAssignee
    updated: str | None = None
    due_date: str | None = None
    issue_type: str | None = None
    project_key: str
    project_name: str
    sprint_names: list[str] = []
    url: str
    story_points: float | None = None


class IssuesResponse(BaseModel):
    issues: list[JiraIssue]


class StatusSummaryItem(BaseModel):
    status_name: str
    total: int
    category_key: str


class AssigneeSummaryItem(BaseModel):
    assignee: str
    total: int


class SummaryResponse(BaseModel):
    total: int
    statuses: list[StatusSummaryItem]
    assignees: list[AssigneeSummaryItem]
    unstarted: list[JiraIssue]
    testing: list[JiraIssue]
