from __future__ import annotations

import re
from collections import Counter
from typing import Any

import httpx
from fastapi import HTTPException

from app.clients.jira_client import JiraClient
from app.core.cache import TTLCache
from app.schemas.jira import (
    AssigneeSummaryItem,
    IssuesResponse,
    JiraAssignee,
    JiraBoard,
    JiraHealthResponse,
    JiraIssue,
    JiraProject,
    JiraSprint,
    JiraStatus,
    JiraUser,
    StatusSummaryItem,
    SummaryResponse,
)


TESTING_KEYWORDS = ("test", "testing", "qa", "uat")
ISSUE_PAGE_SIZE = 100
ISSUE_HARD_CAP = 1000
ISSUE_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]+-\d+$")


class JiraService:
    def __init__(
        self,
        client: JiraClient,
        cache: TTLCache,
        base_url: str,
        sprint_custom_field: str = "customfield_10007",
    ) -> None:
        self.client = client
        self.cache = cache
        self.base_url = base_url.rstrip("/")
        self.sprint_custom_field = sprint_custom_field

    async def check_jira_health(self) -> JiraHealthResponse:
        try:
            data = await self.client.get("/rest/api/2/myself")
            return JiraHealthResponse(
                status="ok",
                ok=True,
                display_name=data.get("displayName"),
                detail=None,
            )
        except httpx.HTTPStatusError as exc:
            return JiraHealthResponse(
                status="error",
                ok=False,
                detail=f"Jira HTTP {exc.response.status_code}",
            )
        except Exception as exc:  # noqa: BLE001
            return JiraHealthResponse(
                status="error",
                ok=False,
                detail=str(exc),
            )

    async def get_projects(self) -> list[JiraProject]:
        cache_key = "projects"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        data = await self.client.get("/rest/api/2/project")
        projects = [
            JiraProject.model_validate(
                {
                    "key": item["key"],
                    "name": item["name"],
                    "projectTypeKey": item.get("projectTypeKey"),
                }
            )
            for item in data
        ]
        return self.cache.set(cache_key, sorted(projects, key=lambda item: item.name.lower()))

    async def get_statuses(self, project_key: str) -> list[JiraStatus]:
        cache_key = f"statuses:{project_key}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        data = await self.client.get(f"/rest/api/2/project/{project_key}/statuses")
        seen: dict[str, JiraStatus] = {}
        for issue_type in data:
            for status in issue_type.get("statuses", []):
                status_id = str(status["id"])
                if status_id in seen:
                    continue
                category = status.get("statusCategory") or {}
                seen[status_id] = JiraStatus(
                    id=status_id,
                    name=status["name"],
                    category_key=category.get("key", "indeterminate"),
                    category_name=category.get("name", "Đang xử lý"),
                )

        statuses = list(seen.values())
        statuses.sort(key=lambda item: (item.category_key, item.name.lower()))
        return self.cache.set(cache_key, statuses)

    async def get_statuses_for_projects(self, project_keys: list[str]) -> list[JiraStatus]:
        if not project_keys:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project key.")

        cache_key = f"statuses:multi:{','.join(project_keys)}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        merged: dict[str, JiraStatus] = {}
        for project_key in project_keys:
            for status in await self.get_statuses(project_key):
                # Prefer id; fall back to name so same workflow merges cleanly.
                merged[status.id or status.name] = status

        statuses = sorted(
            merged.values(),
            key=lambda item: (item.category_key, item.name.lower()),
        )
        return self.cache.set(cache_key, statuses)

    async def get_boards(self, project_key: str) -> list[JiraBoard]:
        cache_key = f"boards:{project_key}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            data = await self.client.get(
                "/rest/agile/1.0/board",
                params={"projectKeyOrId": project_key},
            )
        except httpx.HTTPStatusError:
            # Project may not have Agile boards, or token lacks board permission.
            return self.cache.set(cache_key, [])

        boards = [
            JiraBoard(
                id=int(item["id"]),
                name=str(item.get("name") or f"Board {item['id']}"),
                type=str(item.get("type") or "unknown"),
                project_key=(item.get("location") or {}).get("projectKey") or project_key,
            )
            for item in data.get("values", [])
            if item.get("id") is not None
        ]
        boards.sort(key=lambda item: (item.type != "scrum", item.name.lower()))
        return self.cache.set(cache_key, boards)

    async def get_boards_for_projects(self, project_keys: list[str]) -> list[JiraBoard]:
        if not project_keys:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project key.")

        cache_key = f"boards:multi:{','.join(project_keys)}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        merged: dict[int, JiraBoard] = {}
        for project_key in project_keys:
            for board in await self.get_boards(project_key):
                merged[board.id] = board

        boards = sorted(
            merged.values(),
            key=lambda item: (item.type != "scrum", item.name.lower()),
        )
        return self.cache.set(cache_key, boards)

    async def get_sprints(self, project_key: str) -> list[JiraSprint]:
        cache_key = f"sprints:{project_key}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        board_values = await self.get_boards(project_key)
        if not board_values:
            return self.cache.set(cache_key, [])

        # Sprint API only works on Scrum boards. Kanban boards return 400.
        scrum_boards = [board for board in board_values if board.type == "scrum"]
        candidate_boards = scrum_boards or board_values

        sprints: dict[int, JiraSprint] = {}
        for board in candidate_boards[:5]:
            try:
                data = await self.client.get(
                    f"/rest/agile/1.0/board/{board.id}/sprint",
                    params={"maxResults": 50},
                )
            except httpx.HTTPStatusError:
                # Skip boards that do not support sprints (e.g. Kanban).
                continue

            for sprint in data.get("values", []):
                sprint_model = JiraSprint.model_validate(sprint)
                if sprint_model.state.lower() == "closed":
                    continue
                sprints[sprint_model.id] = sprint_model

        return self.cache.set(
            cache_key,
            sorted(sprints.values(), key=lambda item: (item.state != "active", item.name.lower())),
        )

    async def get_sprints_for_projects(self, project_keys: list[str]) -> list[JiraSprint]:
        if not project_keys:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project key.")

        cache_key = f"sprints:multi:{','.join(project_keys)}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        merged: dict[int, JiraSprint] = {}
        for project_key in project_keys:
            for sprint in await self.get_sprints(project_key):
                merged[sprint.id] = sprint

        sprints = sorted(
            merged.values(),
            key=lambda item: (item.state != "active", item.name.lower()),
        )
        return self.cache.set(cache_key, sprints)

    async def get_users(
        self,
        project_keys: list[str],
        query: str | None = None,
        max_results: int = 100,
    ) -> list[JiraUser]:
        if not project_keys:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project key.")

        cache_key = f"users:{','.join(project_keys)}:{query}:{max_results}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        users_by_id: dict[str, JiraUser] = {}
        for project_key in project_keys:
            try:
                data = await self.client.get(
                    "/rest/api/2/user/assignable/search",
                    params=self._user_search_params(
                        project_key=project_key,
                        query=query,
                        max_results=max_results,
                    ),
                )
            except httpx.HTTPStatusError:
                # Fallback for instances that only support global user search.
                try:
                    data = await self.client.get(
                        "/rest/api/2/user/search",
                        params=self._user_search_params(
                            project_key=None,
                            query=query or ".",
                            max_results=max_results,
                        ),
                    )
                except httpx.HTTPStatusError as exc:
                    raise HTTPException(
                        status_code=exc.response.status_code,
                        detail="Không lấy được danh sách người dùng từ Jira.",
                    ) from exc

            if not isinstance(data, list):
                continue

            for item in data:
                user = self._normalize_user(item)
                if not user.active:
                    continue
                user_id = user.account_id or user.key or user.name or user.display_name
                users_by_id[user_id] = user

        users = sorted(users_by_id.values(), key=lambda item: item.display_name.lower())
        return self.cache.set(cache_key, users)

    def _user_search_params(
        self,
        project_key: str | None,
        query: str | None,
        max_results: int,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"maxResults": max_results}
        if project_key:
            params["project"] = project_key
        # Jira Server uses username; Jira Cloud often uses query.
        if query:
            params["username"] = query
            params["query"] = query
        return params

    def _normalize_user(self, item: dict[str, Any]) -> JiraUser:
        avatars = item.get("avatarUrls") or {}
        return JiraUser(
            name=item.get("name"),
            key=item.get("key"),
            account_id=item.get("accountId"),
            display_name=item.get("displayName") or item.get("name") or "Không rõ",
            email=item.get("emailAddress"),
            avatar_url=avatars.get("48x48") or avatars.get("32x32"),
            active=bool(item.get("active", True)),
        )

    def _issue_fields(self) -> list[str]:
        return [
            "summary",
            "status",
            "priority",
            "assignee",
            "updated",
            "resolutiondate",
            "statuscategorychangedate",
            "duedate",
            "issuetype",
            "parent",
            "project",
            self.sprint_custom_field,
            "customfield_10002",
        ]

    async def get_board_issues(
        self,
        board_id: int,
        assignee: str | None = None,
        assignees: list[str] | None = None,
        query: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> IssuesResponse:
        assignee_key = ",".join(assignees or []) if assignees else (assignee or "")
        cache_key = (
            f"board-issues:{board_id}:{assignee_key}:{query}:{updated_from}:{updated_to}"
        )
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        jql = self._build_board_jql(
            assignee=assignee,
            assignees=assignees,
            query=query,
            updated_from=updated_from,
            updated_to=updated_to,
        )
        issues: list[JiraIssue] = []
        start_at = 0
        total = 0

        while True:
            page_size = min(ISSUE_PAGE_SIZE, ISSUE_HARD_CAP - len(issues))
            if page_size <= 0:
                break

            params: dict[str, Any] = {
                "startAt": start_at,
                "maxResults": page_size,
                "fields": ",".join(self._issue_fields()),
            }
            if jql:
                params["jql"] = jql

            try:
                data = await self.client.get(
                    f"/rest/agile/1.0/board/{board_id}/issue",
                    params=params,
                )
            except httpx.HTTPStatusError as exc:
                detail = "Không truy vấn được issues của board."
                try:
                    body = exc.response.json()
                    messages = body.get("errorMessages") or []
                    if messages:
                        detail = "; ".join(str(item) for item in messages)
                except Exception:  # noqa: BLE001
                    pass
                raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc

            total = int(data.get("total") or 0)
            page_issues = [self._normalize_issue(item) for item in data.get("issues", [])]
            issues.extend(page_issues)

            start_at += len(page_issues)
            if not page_issues or start_at >= total or len(issues) >= ISSUE_HARD_CAP:
                break

        truncated = total > len(issues)
        result = IssuesResponse(
            issues=issues,
            total=total,
            returned=len(issues),
            truncated=truncated,
        )
        return self.cache.set(cache_key, result)

    async def get_issues(
        self,
        project_keys: list[str],
        sprint: str | None = "active",
        assignee: str | None = None,
        assignees: list[str] | None = None,
        query: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
        board: str | None = None,
    ) -> IssuesResponse:
        if not project_keys:
            raise HTTPException(
                status_code=400,
                detail="Cần ít nhất một project key.",
            )

        if board:
            board_id = board.strip()
            if not board_id.isdigit():
                raise HTTPException(status_code=400, detail="board phải là id số.")
            return await self.get_board_issues(
                board_id=int(board_id),
                assignee=assignee,
                assignees=assignees,
                query=query,
                updated_from=updated_from,
                updated_to=updated_to,
            )

        assignee_key = ",".join(assignees or []) if assignees else (assignee or "")
        cache_key = (
            f"issues:{','.join(project_keys)}:{sprint}:{assignee_key}:{query}:{updated_from}:{updated_to}"
        )
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        jql = self._build_jql(
            project_keys,
            sprint=sprint,
            assignee=assignee,
            assignees=assignees,
            query=query,
            updated_from=updated_from,
            updated_to=updated_to,
        )

        issues: list[JiraIssue] = []
        start_at = 0
        total = 0

        while True:
            page_size = min(ISSUE_PAGE_SIZE, ISSUE_HARD_CAP - len(issues))
            if page_size <= 0:
                break

            payload = {
                "jql": jql,
                "startAt": start_at,
                "maxResults": page_size,
                "fields": self._issue_fields(),
            }

            try:
                data = await self.client.post("/rest/api/2/search", json=payload)
            except httpx.HTTPStatusError as exc:
                detail = "Không truy vấn được Jira search."
                try:
                    body = exc.response.json()
                    messages = body.get("errorMessages") or []
                    if messages:
                        detail = "; ".join(str(item) for item in messages)
                except Exception:  # noqa: BLE001
                    pass
                raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc

            total = int(data.get("total") or 0)
            page_issues = [self._normalize_issue(item) for item in data.get("issues", [])]
            issues.extend(page_issues)

            start_at += len(page_issues)
            if not page_issues or start_at >= total or len(issues) >= ISSUE_HARD_CAP:
                break

        truncated = total > len(issues)
        result = IssuesResponse(
            issues=issues,
            total=total,
            returned=len(issues),
            truncated=truncated,
        )
        return self.cache.set(cache_key, result)

    async def get_summary(
        self,
        project_keys: list[str],
        sprint: str | None = "active",
        assignee: str | None = None,
        query: str | None = None,
        board: str | None = None,
    ) -> SummaryResponse:
        issues_response = await self.get_issues(
            project_keys,
            sprint=sprint,
            board=board,
            assignee=assignee,
            query=query,
        )
        issues = issues_response.issues
        status_counter = Counter(issue.status_name for issue in issues)
        category_by_status = {issue.status_name: issue.status_category for issue in issues}
        assignee_counter = Counter(issue.assignee.display_name for issue in issues)

        unstarted = [issue for issue in issues if issue.status_category == "new"][:10]
        testing = [
            issue
            for issue in issues
            if any(keyword in issue.status_name.lower() for keyword in TESTING_KEYWORDS)
        ][:10]

        return SummaryResponse(
            total=issues_response.total,
            returned=issues_response.returned,
            truncated=issues_response.truncated,
            statuses=[
                StatusSummaryItem(
                    status_name=status_name,
                    total=total,
                    category_key=category_by_status.get(status_name, "indeterminate"),
                )
                for status_name, total in status_counter.most_common()
            ],
            assignees=[
                AssigneeSummaryItem(assignee=name, total=total)
                for name, total in assignee_counter.most_common(8)
            ],
            unstarted=unstarted,
            testing=testing,
        )

    def _normalize_issue(self, item: dict[str, Any]) -> JiraIssue:
        fields = item.get("fields", {})
        status = fields.get("status") or {}
        category = status.get("statusCategory") or {}
        assignee = fields.get("assignee") or {}
        priority = fields.get("priority") or {}
        issue_type = fields.get("issuetype") or {}
        project = fields.get("project") or {}
        parent = fields.get("parent") or {}
        sprint_field = fields.get(self.sprint_custom_field) or []
        story_points_raw = fields.get("customfield_10002")
        story_points: float | None
        try:
            story_points = float(story_points_raw) if story_points_raw is not None else None
        except (TypeError, ValueError):
            story_points = None

        parent_key = parent.get("key") if isinstance(parent, dict) else None

        return JiraIssue(
            key=item["key"],
            summary=fields.get("summary", ""),
            status_id=str(status.get("id", "")),
            status_name=status.get("name", "Không rõ"),
            status_category=category.get("key", "indeterminate"),
            priority=priority.get("name"),
            assignee=JiraAssignee(
                name=assignee.get("name"),
                display_name=assignee.get("displayName", "Chưa gán"),
                avatar_url=(assignee.get("avatarUrls") or {}).get("48x48"),
            ),
            updated=fields.get("updated"),
            resolution_date=fields.get("resolutiondate"),
            status_category_change_date=fields.get("statuscategorychangedate"),
            due_date=fields.get("duedate"),
            issue_type=issue_type.get("name"),
            is_subtask=bool(issue_type.get("subtask")),
            parent_key=str(parent_key) if parent_key else None,
            project_key=project.get("key", ""),
            project_name=project.get("name", ""),
            sprint_names=[
                sprint.get("name", "") for sprint in sprint_field if isinstance(sprint, dict)
            ],
            url=f"{self.base_url}/browse/{item['key']}",
            story_points=story_points,
        )

    def _build_query_clause(self, query: str) -> str:
        # Jira rejects `key = "BE"` (not a valid issue key) with HTTP 400.
        if query.startswith("__keys__:"):
            return f"({query.removeprefix('__keys__:')})"
        escaped = query.replace("\\", "\\\\").replace('"', '\\"')
        if ISSUE_KEY_RE.fullmatch(query.strip()):
            key = query.strip().upper().replace("\\", "\\\\").replace('"', '\\"')
            return f'(key = "{key}" OR summary ~ "{escaped}")'
        return f'summary ~ "{escaped}"'

    def _assignee_clause(
        self,
        assignee: str | None,
        assignees: list[str] | None = None,
    ) -> str | None:
        names = [item.strip() for item in (assignees or []) if item and item.strip()]
        if not names and assignee and assignee.strip():
            names = [assignee.strip()]
        if not names:
            return None
        if len(names) == 1:
            return f'assignee = "{names[0]}"'
        quoted = ", ".join(f'"{name}"' for name in names)
        return f"assignee in ({quoted})"

    def _build_board_jql(
        self,
        assignee: str | None,
        query: str | None,
        assignees: list[str] | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> str | None:
        clauses: list[str] = []
        assignee_clause = self._assignee_clause(assignee, assignees)
        if assignee_clause:
            clauses.append(assignee_clause)
        if updated_from:
            clauses.append(f'updated >= "{updated_from}"')
        if updated_to:
            clauses.append(f'updated <= "{updated_to} 23:59"')
        if query:
            clauses.append(self._build_query_clause(query))
        return " AND ".join(clauses) if clauses else None

    def _build_jql(
        self,
        project_keys: list[str],
        sprint: str | None,
        assignee: str | None,
        query: str | None,
        updated_from: str | None = None,
        updated_to: str | None = None,
        assignees: list[str] | None = None,
    ) -> str:
        quoted_projects = ", ".join(f'"{key}"' for key in project_keys)
        clauses = [f"project in ({quoted_projects})"]

        if sprint == "active":
            clauses.append("sprint in openSprints()")
        elif sprint and sprint.isdigit():
            clauses.append(f"sprint = {sprint}")

        assignee_clause = self._assignee_clause(assignee, assignees)
        if assignee_clause:
            clauses.append(assignee_clause)

        if updated_from:
            clauses.append(f'updated >= "{updated_from}"')
        if updated_to:
            clauses.append(f'updated <= "{updated_to} 23:59"')

        if query:
            if query.startswith("__keys__:"):
                clauses.append(self._build_query_clause(query))
                return " AND ".join(clauses) + " ORDER BY updated DESC"
            clauses.append(self._build_query_clause(query))

        return " AND ".join(clauses) + " ORDER BY status ASC, priority DESC, updated DESC"
