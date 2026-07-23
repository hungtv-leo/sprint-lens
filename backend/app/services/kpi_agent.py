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

    committed_issues = []
    for issue in payload.issues:
        if _is_cancelled(issue.status_name):
            evidence.append(
                KpiEvidenceItem(key=issue.key, bucket="excluded", note="Cancelled / withdrawn")
            )
            continue
        committed_issues.append(issue)

    completed_issues = [i for i in committed_issues if i.status_category == "done"]
    incomplete_issues = [i for i in committed_issues if i.status_category != "done"]

    for issue in completed_issues:
        evidence.append(KpiEvidenceItem(key=issue.key, bucket="completed", note=issue.status_name))
    for issue in incomplete_issues:
        evidence.append(KpiEvidenceItem(key=issue.key, bucket="incomplete", note=issue.status_name))

    committed = len(committed_issues)
    completed = len(completed_issues)
    incomplete = len(incomplete_issues)
    commitment_rate = (completed / committed) if committed else 0.0

    on_time_completed = 0
    on_time_eligible = 0
    for issue in completed_issues:
        due = _parse_date(issue.due_date)
        if due is None:
            notes.append(f"{issue.key}: thiếu due_date — loại khỏi Schedule Performance.")
            continue
        on_time_eligible += 1
        done_on = _parse_date(issue.updated) or due
        if done_on <= due:
            on_time_completed += 1
            evidence.append(KpiEvidenceItem(key=issue.key, bucket="on_time", note=f"due {due}"))
        else:
            evidence.append(
                KpiEvidenceItem(key=issue.key, bucket="late", note=f"due {due}, done {done_on}")
            )

    schedule_rate = (on_time_completed / on_time_eligible) if on_time_eligible else None

    points_committed = 0.0
    points_completed = 0.0
    has_points = False
    for issue in committed_issues:
        if issue.story_points is None:
            continue
        has_points = True
        points_committed += float(issue.story_points)
        if issue.status_category == "done":
            points_completed += float(issue.story_points)

    throughput_rate: float | None
    if has_points and points_committed > 0:
        throughput_rate = points_completed / points_committed
    else:
        throughput_rate = None
        notes.append("Không có story points — Work Throughput (J7) = x.")

    j5 = round(commitment_rate, 4)
    k5 = rate_to_score(commitment_rate)
    j6: float | str = round(schedule_rate, 4) if schedule_rate is not None else "x"
    k6 = rate_to_score(schedule_rate)
    j7: float | str = round(throughput_rate, 4) if throughput_rate is not None else "x"
    k7 = rate_to_score(throughput_rate)

    cell_updates = [
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="J5", value=j5),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="K5", value=k5),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="J6", value=j6),
        KpiCellUpdate(sheet=SHEET_DEVELOPER, cell="K6", value=k6),
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
            throughput_rate=round(throughput_rate, 4) if throughput_rate is not None else None,
        ),
        cell_updates=cell_updates,
        evidence=evidence,
        notes=notes,
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
