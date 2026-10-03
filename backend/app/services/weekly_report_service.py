from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException

from app.schemas.jira import JiraIssue
from app.schemas.weekly_report import (
    WeeklyAssigneeStat,
    WeeklyBucketStat,
    WeeklyReportIssue,
    WeeklyReportResponse,
)
from app.services.jira_service import JiraService

BUCKET_ORDER = (
    "in_progress",
    "ready_for_test",
    "testing",
    "done",
    "cancelled",
    "other",
)

BUCKET_LABELS = {
    "in_progress": "Đang làm",
    "ready_for_test": "Dev done",
    "testing": "Đang Test",
    "done": "Done",
    "cancelled": "Hủy bỏ",
    "other": "Khác",
}

STATUS_TO_BUCKET = {
    "in progress": "in_progress",
    "ready for test": "ready_for_test",
    "testing": "testing",
    "done": "done",
    "cancelled": "cancelled",
}

# Statuses considered active report work when issue is outside a sprint (Ad-hoc).
ADHOC_ACTIVE_BUCKETS = {
    "in_progress",
    "ready_for_test",
    "testing",
    "done",
    "cancelled",
}


def normalize_status_name(status_name: str | None) -> str:
    return " ".join((status_name or "").strip().lower().split())


def bucket_for_status(status_name: str | None) -> str:
    return STATUS_TO_BUCKET.get(normalize_status_name(status_name), "other")


def is_reportable_work(item: WeeklyReportIssue) -> bool:
    """Hide Scrum backlog items that were never pulled into a sprint.

    - Issues from the active-sprint query are always kept.
    - Issues already carrying a sprint name are kept.
    - Ad-hoc issues without sprint are kept only when status is active work
      (In Progress / Ready for test / Testing / Done / Cancelled).
    - Parent stubs are handled separately for tree display.
    """
    if item.source == "parent" and not item.matched:
        return True
    if item.source in {"sprint", "both"}:
        return True
    if item.sprint_names:
        return True
    if item.source == "adhoc" and item.bucket in ADHOC_ACTIVE_BUCKETS:
        return True
    return False


class WeeklyReportService:
    def __init__(self, jira: JiraService) -> None:
        self.jira = jira

    def _default_range(self) -> tuple[str, str]:
        end = date.today()
        start = end - timedelta(days=6)
        return start.isoformat(), end.isoformat()

    def _parse_range(self, date_from: str | None, date_to: str | None) -> tuple[str, str]:
        default_from, default_to = self._default_range()
        start = date_from.strip() if date_from else default_from
        end = date_to.strip() if date_to else default_to
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="date_from/date_to phải có dạng YYYY-MM-DD.",
            ) from exc
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="date_from không được sau date_to.")
        return start_date.isoformat(), end_date.isoformat()

    async def _resolve_adhoc_board(
        self,
        project_keys: list[str],
        board_id: int | None,
    ) -> tuple[int | None, str | None, list[str]]:
        notes: list[str] = []
        boards = await self.jira.get_boards_for_projects(project_keys)
        if board_id is not None:
            matched = next((item for item in boards if item.id == board_id), None)
            if matched is None:
                notes.append(f"Không tìm thấy board id={board_id} trong project đã chọn.")
                return None, None, notes
            return matched.id, matched.name, notes

        adhoc = next(
            (
                item
                for item in boards
                if "ad-hoc" in item.name.lower() or "adhoc" in item.name.lower()
            ),
            None,
        )
        if adhoc is None:
            notes.append('Không tìm thấy board tên chứa "Ad-hoc". Chỉ lấy sprint đang chạy.')
            return None, None, notes
        return adhoc.id, adhoc.name, notes

    def _to_report_issue(
        self,
        issue: JiraIssue,
        source: str,
        *,
        matched: bool = True,
    ) -> WeeklyReportIssue:
        bucket = bucket_for_status(issue.status_name)
        return WeeklyReportIssue(
            key=issue.key,
            summary=issue.summary,
            status_name=issue.status_name,
            status_category=issue.status_category,
            bucket=bucket,
            bucket_label=BUCKET_LABELS[bucket],
            source=source,
            assignee_name=issue.assignee.name,
            assignee_display_name=issue.assignee.display_name,
            project_key=issue.project_key,
            sprint_names=issue.sprint_names,
            updated=issue.updated,
            url=issue.url,
            is_subtask=bool(issue.is_subtask or issue.parent_key),
            parent_key=issue.parent_key,
            matched=matched,
        )

    async def _fetch_missing_parents(
        self,
        project_keys: list[str],
        merged: dict[str, WeeklyReportIssue],
    ) -> None:
        missing_parents = sorted(
            {
                item.parent_key
                for item in merged.values()
                if item.parent_key and item.parent_key not in merged
            }
        )
        if not missing_parents:
            return

        # Fetch in chunks to keep JQL short.
        chunk_size = 50
        for index in range(0, len(missing_parents), chunk_size):
            chunk = missing_parents[index : index + chunk_size]
            keys_clause = ", ".join(chunk)
            response = await self.jira.get_issues(
                project_keys,
                sprint=None,
                query=f"__keys__:key in ({keys_clause})",
            )
            for issue in response.issues:
                if issue.key in merged:
                    continue
                merged[issue.key] = self._to_report_issue(
                    issue,
                    source="parent",
                    matched=False,
                )

    def _drop_backlog_issues(self, merged: dict[str, WeeklyReportIssue]) -> None:
        for key in [
            item_key
            for item_key, item in merged.items()
            if item.matched and not is_reportable_work(item)
        ]:
            del merged[key]

        child_parent_keys = {
            item.parent_key
            for item in merged.values()
            if item.parent_key and item.matched
        }
        for key in [
            item_key
            for item_key, item in merged.items()
            if item.source == "parent" and not item.matched and item_key not in child_parent_keys
        ]:
            del merged[key]

    async def build_report(
        self,
        project_keys: list[str],
        assignees: list[str],
        date_from: str | None = None,
        date_to: str | None = None,
        adhoc_board_id: int | None = None,
    ) -> WeeklyReportResponse:
        projects = [item.strip() for item in project_keys if item.strip()]
        people = [item.strip() for item in assignees if item.strip()]
        if not projects:
            raise HTTPException(status_code=400, detail="Cần ít nhất một project key.")
        if not people:
            raise HTTPException(status_code=400, detail="Cần chọn ít nhất một người.")

        start, end = self._parse_range(date_from, date_to)
        board_id, board_name, notes = await self._resolve_adhoc_board(projects, adhoc_board_id)

        sprint_response = await self.jira.get_issues(
            projects,
            sprint="active",
            assignees=people,
            updated_from=start,
            updated_to=end,
        )

        adhoc_issues: list[JiraIssue] = []
        adhoc_truncated = False
        if board_id is not None:
            adhoc_response = await self.jira.get_board_issues(
                board_id=board_id,
                assignees=people,
                updated_from=start,
                updated_to=end,
            )
            adhoc_issues = adhoc_response.issues
            adhoc_truncated = adhoc_response.truncated

        merged: dict[str, WeeklyReportIssue] = {}
        for issue in sprint_response.issues:
            merged[issue.key] = self._to_report_issue(issue, source="sprint")
        for issue in adhoc_issues:
            existing = merged.get(issue.key)
            if existing is None:
                merged[issue.key] = self._to_report_issue(issue, source="adhoc")
            else:
                existing.source = "both"

        await self._fetch_missing_parents(projects, merged)
        self._drop_backlog_issues(merged)

        issues = list(merged.values())
        issues.sort(key=lambda item: item.key)
        issues.sort(key=lambda item: item.updated or "", reverse=True)
        issues.sort(
            key=lambda item: BUCKET_ORDER.index(item.bucket)
            if item.bucket in BUCKET_ORDER
            else len(BUCKET_ORDER)
        )
        issues.sort(key=lambda item: item.assignee_display_name.lower())
        # Parents before their subtasks when flattened; frontend builds the tree.
        issues.sort(key=lambda item: (item.parent_key or item.key, item.is_subtask, item.key))

        bucket_totals = {code: 0 for code in BUCKET_ORDER}
        assignee_map: dict[str, WeeklyAssigneeStat] = {}
        matched_count = 0

        for item in issues:
            if not item.matched:
                continue
            matched_count += 1
            bucket_totals[item.bucket] = bucket_totals.get(item.bucket, 0) + 1
            assignee_key = item.assignee_name or item.assignee_display_name
            existing = assignee_map.get(assignee_key)
            if existing is None:
                assignee_map[assignee_key] = WeeklyAssigneeStat(
                    assignee=assignee_key,
                    assignee_display_name=item.assignee_display_name,
                    total=1,
                    by_bucket={item.bucket: 1},
                )
            else:
                existing.total += 1
                existing.by_bucket[item.bucket] = existing.by_bucket.get(item.bucket, 0) + 1

        by_bucket = [
            WeeklyBucketStat(
                bucket=code,
                label=BUCKET_LABELS[code],
                total=bucket_totals.get(code, 0),
            )
            for code in BUCKET_ORDER
            if bucket_totals.get(code, 0) > 0 or code != "other"
        ]
        by_assignee = sorted(
            assignee_map.values(),
            key=lambda item: item.assignee_display_name.lower(),
        )

        return WeeklyReportResponse(
            projects=projects,
            date_from=start,
            date_to=end,
            assignees=people,
            adhoc_board_id=board_id,
            adhoc_board_name=board_name,
            total=matched_count,
            truncated=bool(sprint_response.truncated or adhoc_truncated),
            by_bucket=by_bucket,
            by_assignee=by_assignee,
            issues=issues,
            notes=notes,
        )
