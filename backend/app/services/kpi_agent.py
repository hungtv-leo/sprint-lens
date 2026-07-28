from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.schemas.kpi import (
    KpiAgentPayload,
    KpiAgentResult,
    KpiCellUpdate,
    KpiEvidenceItem,
    KpiStats,
)

SHEET_DEVELOPER = "KPI Developer Demo"

ROLE_SKILL_DIRS: dict[str, str] = {
    "developer": "kpi-developer",
}

CANCEL_KEYWORDS = ("cancel", "hủy", "huy", "won't", "wont", "withdrawn", "obsolete")


def repo_root() -> Path:
    # backend/app/services/kpi_agent.py -> repo root
    return Path(__file__).resolve().parents[3]


def skill_dir_for_role(role: str) -> Path:
    skill_name = ROLE_SKILL_DIRS.get(role)
    if not skill_name:
        raise HTTPException(status_code=400, detail=f"Role không được hỗ trợ: {role}")
    path = repo_root() / ".cursor" / "skills" / skill_name
    if not path.is_dir():
        raise HTTPException(status_code=500, detail=f"Không tìm thấy skill: {path}")
    return path


def load_skill_text(role: str) -> str:
    skill_path = skill_dir_for_role(role)
    parts: list[str] = []
    for name in ("SKILL.md", "reference-mapping.md", "input-output.schema.md"):
        file_path = skill_path / name
        if file_path.is_file():
            parts.append(f"# File: {name}\n\n{file_path.read_text(encoding='utf-8')}")
    if not parts:
        raise HTTPException(status_code=500, detail="Skill rỗng.")
    return "\n\n---\n\n".join(parts)


def _is_cancelled(status_name: str) -> bool:
    lowered = status_name.lower()
    return any(keyword in lowered for keyword in CANCEL_KEYWORDS)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def rate_to_score(rate: float | None) -> float | str:
    if rate is None:
        return "x"
    if rate >= 1.0:
        return 10.0
    if rate >= 0.95:
        return 9.5
    if rate >= 0.90:
        return 9.0
    if rate >= 0.80:
        return 8.0
    return 6.0


def compute_developer_kpi(payload: KpiAgentPayload) -> KpiAgentResult:
    """Apply kpi-developer skill rules to the issue dataset."""
    evidence: list[KpiEvidenceItem] = []
    notes: list[str] = []
    trace: list[str] = []
    issues_by_key = {issue.key.upper(): issue for issue in payload.issues}

    committed_issues = []
    completed_issues = []
    incomplete_issues = []

    planned_items = payload.plan_items or []
    if not planned_items:
        for issue in payload.issues:
            if _is_cancelled(issue.status_name):
                evidence.append(
                    KpiEvidenceItem(key=issue.key, bucket="excluded", note="Đã hủy / rút lại")
                )
                continue
            committed_issues.append(issue)
    else:
        plan_type_labels = {
            "committed": "Cam kết",
            "stretch": "Phát sinh",
            "out_of_scope": "Ngoài phạm vi",
        }
        for item in planned_items:
            issue = issues_by_key.get(item.issue_key.upper())
            if issue is None:
                evidence.append(
                    KpiEvidenceItem(
                        key=item.issue_key,
                        bucket="missing_jira",
                        note=f"Không tìm thấy issue cho dòng kế hoạch {item.row_number}",
                    )
                )
                continue
            if item.plan_type != "committed":
                evidence.append(
                    KpiEvidenceItem(
                        key=issue.key,
                        bucket="excluded",
                        note=f"Bỏ qua loại kế hoạch={plan_type_labels.get(item.plan_type, item.plan_type)}",
                    )
                )
                continue
            if item.exclusion_reason and item.exclusion_reason.strip():
                evidence.append(
                    KpiEvidenceItem(
                        key=issue.key,
                        bucket="excluded",
                        note=item.exclusion_reason.strip(),
                    )
                )
                continue
            if _is_cancelled(issue.status_name):
                evidence.append(
                    KpiEvidenceItem(key=issue.key, bucket="excluded", note="Đã hủy / rút lại")
                )
                continue
            committed_issues.append(issue)

    for issue in committed_issues:
        if issue.status_category == "done":
            completed_issues.append(issue)
            evidence.append(KpiEvidenceItem(key=issue.key, bucket="completed", note=issue.status_name))
        else:
            incomplete_issues.append(issue)
            evidence.append(KpiEvidenceItem(key=issue.key, bucket="incomplete", note=issue.status_name))

    committed = len(committed_issues)
    completed = len(completed_issues)
    incomplete = len(incomplete_issues)
    commitment_rate = (completed / committed) if committed else 0.0
    trace.append(f"Cam kết: {completed}/{committed} issue hoàn thành.")

    plan_by_key = {item.issue_key.upper(): item for item in planned_items}
    on_time_completed = 0
    on_time_eligible = 0
    schedule_sources: set[str] = set()
    for issue in completed_issues:
        planned = plan_by_key.get(issue.key.upper())
        if issue.due_date:
            schedule_sources.add("jira_due_date")
            due = _parse_date(issue.due_date)
        else:
            due = _parse_date(planned.expected_due_date if planned else None)
            if due is not None:
                schedule_sources.add("plan_due_date")
        if due is None:
            notes.append(f"{issue.key}: thiếu hạn dự kiến — loại khỏi Đúng hạn.")
            continue
        on_time_eligible += 1
        done_on = _parse_date(issue.updated) or due
        if done_on <= due:
            on_time_completed += 1
            evidence.append(KpiEvidenceItem(key=issue.key, bucket="on_time", note=f"hạn {due}"))
        else:
            evidence.append(
                KpiEvidenceItem(
                    key=issue.key,
                    bucket="late",
                    note=f"hạn {due}, hoàn thành {done_on}",
                )
            )

    schedule_rate = (on_time_completed / on_time_eligible) if on_time_eligible else None
    if not schedule_sources:
        schedule_source = "none"
    elif len(schedule_sources) == 1:
        schedule_source = next(iter(schedule_sources))
    else:
        schedule_source = "mixed"
    if on_time_eligible:
        trace.append(
            f"Đúng hạn: {on_time_completed}/{on_time_eligible} issue đủ điều kiện, nguồn={schedule_source}."
        )
        trace.append("Đúng hạn hiện dùng thời điểm `updated` trên Jira như tín hiệu hoàn thành gần đúng.")

    points_ready = bool(committed_issues) and all(issue.story_points is not None for issue in committed_issues)
    scope_ready = bool(committed_issues) and all(
        (plan_by_key.get(issue.key.upper()) and plan_by_key[issue.key.upper()].scope_score is not None)
        for issue in committed_issues
    )

    throughput_source: str = "none"
    throughput_rate: float | None = None
    throughput_completed_scope: float | None = None
    throughput_committed_scope: float | None = None
    if points_ready:
        throughput_source = "story_points"
        throughput_committed_scope = sum(float(issue.story_points or 0) for issue in committed_issues)
        throughput_completed_scope = sum(float(issue.story_points or 0) for issue in completed_issues)
    elif scope_ready:
        throughput_source = "scope_score"
        throughput_committed_scope = sum(
            float(plan_by_key[issue.key.upper()].scope_score or 0) for issue in committed_issues
        )
        throughput_completed_scope = sum(
            float(plan_by_key[issue.key.upper()].scope_score or 0) for issue in completed_issues
        )
    else:
        notes.append("Thiếu story points và scope score đầy đủ — Work Throughput (J7) = x.")

    if throughput_committed_scope and throughput_committed_scope > 0:
        throughput_rate = throughput_completed_scope / throughput_committed_scope
    if throughput_source != "none" and throughput_committed_scope is not None:
        trace.append(
            "Thông lượng: "
            f"{throughput_completed_scope}/{throughput_committed_scope}, nguồn={throughput_source}."
        )

    j5 = round(commitment_rate, 4)
    k5 = rate_to_score(commitment_rate)
    j6: float | str = round(schedule_rate, 4) if schedule_rate is not None else "x"
    k6 = rate_to_score(schedule_rate)
    j7: float | str = round(throughput_rate, 4) if throughput_rate is not None else "x"
    k7 = rate_to_score(throughput_rate)

    cell_updates = [
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="H5", value=completed),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="I5", value=committed),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="J5", value=j5),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="K5", value=k5),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="H6", value=on_time_completed),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="I6", value=on_time_eligible),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="J6", value=j6),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="K6", value=k6),
        KpiCellUpdate(
            sheet=SHEET_DEVELOPER,
            cell="H7",
            value=round(throughput_completed_scope, 4) if throughput_completed_scope is not None else "x",
        ),
        KpiCellUpdate(
            sheet=SHEET_DEVELOPER,
            cell="I7",
            value=round(throughput_committed_scope, 4) if throughput_committed_scope is not None else "x",
        ),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="J7", value=j7),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="K7", value=k7),
    ]

    return KpiAgentResult(
        stats=KpiStats(
            committed=committed,
            completed=completed,
            incomplete=incomplete,
            on_time_completed=on_time_completed,
            on_time_eligible=on_time_eligible,
            commitment_rate=round(commitment_rate, 4),
            schedule_rate=round(schedule_rate, 4) if schedule_rate is not None else None,
            schedule_source=schedule_source,
            throughput_rate=round(throughput_rate, 4) if throughput_rate is not None else None,
            throughput_source=throughput_source,
            throughput_completed_scope=round(throughput_completed_scope, 4)
            if throughput_completed_scope is not None
            else None,
            throughput_committed_scope=round(throughput_committed_scope, 4)
            if throughput_committed_scope is not None
            else None,
        ),
        cell_updates=cell_updates,
        evidence=evidence,
        notes=notes,
        trace=trace,
    )


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("Agent không trả về JSON hợp lệ.")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("JSON Agent không phải object.")
    return data


class KpiAgentRunner(ABC):
    name: str

    @abstractmethod
    async def run(self, payload: KpiAgentPayload) -> KpiAgentResult:
        raise NotImplementedError


class LocalSkillAgentRunner(KpiAgentRunner):
    """Agent that loads the role skill and applies its calculation rules locally."""

    name = "local-skill"

    async def run(self, payload: KpiAgentPayload) -> KpiAgentResult:
        # Ensure skill exists / is readable for this role.
        load_skill_text(payload.role)
        if payload.role == "developer":
            return compute_developer_kpi(payload)
        raise HTTPException(status_code=400, detail=f"Chưa có skill tính toán cho role: {payload.role}")


class CursorSdkAgentRunner(KpiAgentRunner):
    """Invoke Cursor SDK Agent with the role skill injected into the prompt."""

    name = "cursor-sdk"

    def __init__(self, api_key: str, model: str = "composer-2.5") -> None:
        self.api_key = api_key
        self.model = model

    async def run(self, payload: KpiAgentPayload) -> KpiAgentResult:
        import asyncio

        skill_text = load_skill_text(payload.role)
        prompt = (
            "You are the Sprint Lens KPI agent.\n"
            "Follow the skill below exactly. Compute Developer KPI from the issues JSON.\n"
            "Return ONLY one JSON object matching the skill output schema.\n\n"
            f"{skill_text}\n\n"
            "## Payload\n\n"
            f"```json\n{payload.model_dump_json(indent=2)}\n```\n"
        )

        def _call() -> str:
            from cursor_sdk import Agent, AgentOptions, LocalAgentOptions

            result = Agent.prompt(
                prompt,
                AgentOptions(
                    api_key=self.api_key,
                    model=self.model,
                    local=LocalAgentOptions(cwd=str(repo_root())),
                ),
            )
            return getattr(result, "result", None) or str(result)

        try:
            raw = await asyncio.to_thread(_call)
            data = extract_json_object(raw)
            return KpiAgentResult.model_validate(data)
        except Exception as exc:  # noqa: BLE001 — fall back to local skill agent
            local = LocalSkillAgentRunner()
            result = await local.run(payload)
            result.notes = [
                *result.notes,
                f"Cursor SDK lỗi ({exc}); đã dùng local-skill agent theo cùng skill.",
            ]
            return result


def build_kpi_agent_runner(cursor_api_key: str | None, prefer_cursor: bool = True) -> KpiAgentRunner:
    if prefer_cursor and cursor_api_key and cursor_api_key.strip():
        return CursorSdkAgentRunner(api_key=cursor_api_key.strip())
    return LocalSkillAgentRunner()
