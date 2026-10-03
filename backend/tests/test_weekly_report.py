from __future__ import annotations

import pytest

from app.schemas.jira import IssuesResponse, JiraAssignee, JiraBoard, JiraIssue
from app.schemas.weekly_report import WeeklyReportIssue
from app.services.weekly_report_service import (
    WeeklyReportService,
    bucket_for_status,
    is_reportable_work,
)


def make_issue(
    key: str,
    *,
    status_name: str,
    assignee_name: str,
    assignee_display_name: str,
    updated: str,
    is_subtask: bool = False,
    parent_key: str | None = None,
) -> JiraIssue:
    return JiraIssue(
        key=key,
        summary=f"Summary {key}",
        status_id="1",
        status_name=status_name,
        status_category="done" if status_name == "Done" else "indeterminate",
        assignee=JiraAssignee(name=assignee_name, display_name=assignee_display_name),
        updated=updated,
        is_subtask=is_subtask,
        parent_key=parent_key,
        project_key="TI",
        project_name="TI",
        sprint_names=["Sprint 1"] if key.startswith("TI-1") else [],
        url=f"https://jira.local/browse/{key}",
    )


class FakeJira:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def get_boards_for_projects(self, project_keys: list[str]) -> list[JiraBoard]:
        self.calls.append({"method": "boards", "project_keys": project_keys})
        return [
            JiraBoard(id=10, name="Scrum Board", type="scrum", project_key="TI"),
            JiraBoard(id=22, name="Ad-hoc tasks", type="kanban", project_key="TI"),
        ]

    async def get_issues(self, project_keys, **kwargs) -> IssuesResponse:
        self.calls.append({"method": "issues", "project_keys": project_keys, **kwargs})
        query = str(kwargs.get("query") or "")
        if query.startswith("__keys__:"):
            return IssuesResponse(
                issues=[
                    make_issue(
                        "TI-100",
                        status_name="In Progress",
                        assignee_name="hung",
                        assignee_display_name="Hưng",
                        updated="2026-09-20T10:00:00.000+0000",
                    )
                ],
                total=1,
                returned=1,
                truncated=False,
            )
        return IssuesResponse(
            issues=[
                make_issue(
                    "TI-101",
                    status_name="In Progress",
                    assignee_name="hung",
                    assignee_display_name="Hưng",
                    updated="2026-10-02T10:00:00.000+0000",
                ),
                make_issue(
                    "TI-102",
                    status_name="Ready for test",
                    assignee_name="huong",
                    assignee_display_name="Dương Thu Hương",
                    updated="2026-10-01T10:00:00.000+0000",
                ),
                make_issue(
                    "TI-103",
                    status_name="Testing",
                    assignee_name="dat",
                    assignee_display_name="Đạt Nguyễn",
                    updated="2026-10-02T12:00:00.000+0000",
                    is_subtask=True,
                    parent_key="TI-100",
                ),
            ],
            total=3,
            returned=3,
            truncated=False,
        )

    async def get_board_issues(self, board_id: int, **kwargs) -> IssuesResponse:
        self.calls.append({"method": "board_issues", "board_id": board_id, **kwargs})
        return IssuesResponse(
            issues=[
                make_issue(
                    "TI-102",
                    status_name="Ready for test",
                    assignee_name="huong",
                    assignee_display_name="Dương Thu Hương",
                    updated="2026-10-01T10:00:00.000+0000",
                ),
                make_issue(
                    "TI-201",
                    status_name="Testing",
                    assignee_name="dat",
                    assignee_display_name="Đạt Nguyễn",
                    updated="2026-09-30T10:00:00.000+0000",
                ),
                make_issue(
                    "TI-202",
                    status_name="Cancelled",
                    assignee_name="hung",
                    assignee_display_name="Hưng",
                    updated="2026-09-29T10:00:00.000+0000",
                ),
                make_issue(
                    "TI-300",
                    status_name="To Do",
                    assignee_name="hung",
                    assignee_display_name="Hưng",
                    updated="2026-10-02T08:00:00.000+0000",
                ),
            ],
            total=4,
            returned=4,
            truncated=False,
        )


def test_bucket_mapping():
    assert bucket_for_status("In Progress") == "in_progress"
    assert bucket_for_status("Ready for test") == "ready_for_test"
    assert bucket_for_status("Testing") == "testing"
    assert bucket_for_status("Done") == "done"
    assert bucket_for_status("Cancelled") == "cancelled"
    assert bucket_for_status("Blocked") == "other"


def test_backlog_without_sprint_is_hidden():
    backlog = WeeklyReportIssue(
        key="TI-9",
        summary="Backlog item",
        status_name="To Do",
        status_category="new",
        bucket="other",
        bucket_label="Khác",
        source="adhoc",
        assignee_display_name="Hưng",
        project_key="TI",
        sprint_names=[],
        url="https://jira.local/browse/TI-9",
        matched=True,
    )
    assert is_reportable_work(backlog) is False

    adhoc_active = backlog.model_copy(
        update={
            "status_name": "In Progress",
            "bucket": "in_progress",
            "bucket_label": "Đang làm",
        }
    )
    assert is_reportable_work(adhoc_active) is True

    in_sprint = backlog.model_copy(
        update={"sprint_names": ["Sprint 12"], "source": "sprint"}
    )
    assert is_reportable_work(in_sprint) is True


@pytest.mark.asyncio
async def test_weekly_report_merges_sprint_and_adhoc():
    service = WeeklyReportService(jira=FakeJira())
    report = await service.build_report(
        project_keys=["TI"],
        assignees=["hung", "huong", "dat"],
        date_from="2026-09-27",
        date_to="2026-10-03",
    )

    assert report.total == 5
    assert report.adhoc_board_id == 22
    assert report.adhoc_board_name == "Ad-hoc tasks"
    keys = {item.key for item in report.issues}
    assert keys == {"TI-100", "TI-101", "TI-102", "TI-103", "TI-201", "TI-202"}
    assert "TI-300" not in keys

    parent = next(item for item in report.issues if item.key == "TI-100")
    assert parent.matched is False
    assert parent.source == "parent"

    child = next(item for item in report.issues if item.key == "TI-103")
    assert child.is_subtask is True
    assert child.parent_key == "TI-100"

    issue_102 = next(item for item in report.issues if item.key == "TI-102")
    assert issue_102.source == "both"
    assert issue_102.bucket == "ready_for_test"

    by_bucket = {item.bucket: item.total for item in report.by_bucket}
    assert by_bucket["in_progress"] == 1
    assert by_bucket["ready_for_test"] == 1
    assert by_bucket["testing"] == 2
    assert by_bucket["cancelled"] == 1

    assert len(report.by_assignee) == 3
