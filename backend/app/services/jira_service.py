from __future__ import annotations

from collections import Counter
from typing import Any

import httpx
from fastapi import HTTPException

from app.clients.jira_client import JiraClient
from app.core.cache import TTLCache
from app.schemas.jira import (
    AssigneeSummaryItem,
    JiraAssignee,
    JiraIssue,
    JiraProject,
    JiraSprint,
    JiraStatus,
    JiraUser,
    StatusSummaryItem,
    SummaryResponse,
)


TESTING_KEYWORDS = ("test", "testing", "qa", "uat")


class JiraService:
    def __init__(self, client: JiraClient, cache: TTLCache, base_url: str) -> None:
        self.client = client
        self.cache = cache
        self.base_url = base_url.rstrip("/")

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

    async def get_sprints(self, project_key: str) -> list[JiraSprint]:
        cache_key = f"sprints:{project_key}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            boards = await self.client.get(
                "/rest/agile/1.0/board",
                params={"projectKeyOrId": project_key},
            )
        except httpx.HTTPStatusError:
            # Project may not have Agile boards, or token lacks board permission.
            return self.cache.set(cache_key, [])

        board_values = boards.get("values", [])
        if not board_values:
            return self.cache.set(cache_key, [])

        # Sprint API only works on Scrum boards. Kanban boards return 400.
        scrum_boards = [board for board in board_values if board.get("type") == "scrum"]
        candidate_boards = scrum_boards or board_values

        sprints: dict[int, JiraSprint] = {}
        for board in candidate_boards[:5]:
            try:
                data = await self.client.get(
                    f"/rest/agile/1.0/board/{board['id']}/sprint",
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

    async def get_issues(
        self,
        project_keys: list[str],
        sprint: str | None = "active",
        assignee: str | None = None,
        query: str | None = None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> list[JiraIssue]:
        cache_key = (
            f"issues:{','.join(project_keys)}:{sprint}:{assignee}:{query}:{updated_from}:{updated_to}"
        )
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        if not project_keys:
            raise HTTPException(
                status_code=400,
                detail="Cần ít nhất một project key.",
            )

        jql = self._build_jql(
            project_keys,
            sprint=sprint,
            assignee=assignee,
            query=query,
            updated_from=updated_from,
            updated_to=updated_to,
        )
        payload = {
            "jql": jql,
            "maxResults": 200,
            "fields": [
                "summary",
                "status",
                "priority",
                "assignee",
                "updated",
                "duedate",
                "issuetype",
                "project",
                "customfield_10007",
                "customfield_10002",
            ],
        }

        data = await self.client.post("/rest/api/2/search", json=payload)
        issues = [self._normalize_issue(item) for item in data.get("issues", [])]
        return self.cache.set(cache_key, issues)

    async def get_summary(
        self,
        project_keys: list[str],
        sprint: str | None = "active",
        assignee: str | None = None,
        query: str | None = None,
    ) -> SummaryResponse:
        issues = await self.get_issues(project_keys, sprint=sprint, assignee=assignee, query=query)
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
            total=len(issues),
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
        sprint_field = fields.get("customfield_10007") or []
        story_points_raw = fields.get("customfield_10002")
        story_points: float | None
        try:
            story_points = float(story_points_raw) if story_points_raw is not None else None
        except (TypeError, ValueError):
            story_points = None

        return JiraIssue(
            key=item["key"],
            summary=fields.get("summary", ""),
            status_id=str(status.get("id", "")),
            status_name=status.get("name", "Không rõ"),
            status_category=category.get("key", "indeterminate"),
            priority=priority.get("name"),
            assignee=JiraAssignee(
                display_name=assignee.get("displayName", "Chưa gán"),
                avatar_url=(assignee.get("avatarUrls") or {}).get("48x48"),
            ),
            updated=fields.get("updated"),
            due_date=fields.get("duedate"),
            issue_type=issue_type.get("name"),
            project_key=project.get("key", ""),
            project_name=project.get("name", ""),
            sprint_names=[sprint.get("name", "") for sprint in sprint_field if isinstance(sprint, dict)],
            url=f"{self.base_url}/browse/{item['key']}",
            story_points=story_points,
        )

    def _build_jql(
        self,
        project_keys: list[str],
        sprint: str | None,
        assignee: str | None,
        query: str | None,
        updated_from: str | None = None,
        updated_to: str | None = None,
    ) -> str:
        quoted_projects = ", ".join(f'"{key}"' for key in project_keys)
        clauses = [f"project in ({quoted_projects})"]

        if sprint == "active":
            clauses.append("sprint in openSprints()")
        elif sprint and sprint.isdigit():
            clauses.append(f"sprint = {sprint}")

        if assignee:
            clauses.append(f'assignee = "{assignee}"')

        if updated_from:
            clauses.append(f'updated >= "{updated_from}"')
        if updated_to:
            clauses.append(f'updated <= "{updated_to} 23:59"')

        if query:
            escaped = query.replace('"', '\\"')
            clauses.append(f'(summary ~ "{escaped}" OR key = "{escaped}")')

        return " AND ".join(clauses) + " ORDER BY status ASC, priority DESC, updated DESC"
