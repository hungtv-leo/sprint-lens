from __future__ import annotations

from typing import Any

import pytest

from app.core.cache import TTLCache
from app.services.jira_service import JiraService


class FakeJiraClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any] | None]] = []

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        self.calls.append((path, params))
        if path == "/rest/agile/1.0/board":
            return {
                "values": [
                    {
                        "id": 10,
                        "name": "Scrum Board",
                        "type": "scrum",
                        "location": {"projectKey": "TI"},
                    },
                    {
                        "id": 22,
                        "name": "Ad-hoc tasks",
                        "type": "kanban",
                        "location": {"projectKey": "TI"},
                    },
                ]
            }
        if path == "/rest/agile/1.0/board/22/issue":
            return {
                "total": 1,
                "issues": [
                    {
                        "key": "TI-999",
                        "fields": {
                            "summary": "Ad-hoc support",
                            "status": {
                                "id": "1",
                                "name": "To Do",
                                "statusCategory": {"key": "new", "name": "To Do"},
                            },
                            "priority": {"name": "Medium"},
                            "assignee": {
                                "name": "ops.user",
                                "displayName": "Ops User",
                                "avatarUrls": {"48x48": "http://example/a.png"},
                            },
                            "updated": "2026-10-03T01:00:00.000+0000",
                            "issuetype": {"name": "Task", "subtask": False},
                            "project": {"key": "TI", "name": "TI"},
                            "customfield_10007": [],
                            "customfield_10002": None,
                        },
                    }
                ],
            }
        raise AssertionError(f"Unexpected path: {path}")

    async def post(self, path: str, json: dict[str, Any]) -> Any:  # noqa: ARG002
        raise AssertionError("search should not be used for board issues")


@pytest.mark.asyncio
async def test_get_boards_includes_adhoc():
    client = FakeJiraClient()
    service = JiraService(client=client, cache=TTLCache(ttl_seconds=60), base_url="http://jira")

    boards = await service.get_boards("TI")
    assert [board.name for board in boards] == ["Scrum Board", "Ad-hoc tasks"]
    assert boards[1].id == 22
    assert boards[1].type == "kanban"


@pytest.mark.asyncio
async def test_get_issues_by_board_uses_agile_api():
    client = FakeJiraClient()
    service = JiraService(client=client, cache=TTLCache(ttl_seconds=60), base_url="http://jira")

    result = await service.get_issues(["TI"], board="22", assignee="ops.user")
    assert result.total == 1
    assert result.issues[0].key == "TI-999"
    assert result.issues[0].assignee.display_name == "Ops User"

    board_calls = [call for call in client.calls if call[0].endswith("/issue")]
    assert len(board_calls) == 1
    assert board_calls[0][1] is not None
    assert board_calls[0][1]["jql"] == 'assignee = "ops.user"'
