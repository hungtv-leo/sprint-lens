import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from app.dependencies import get_kpi_service
from app.schemas.kpi import KpiCalculateResponse, KpiPeriod, KpiRequest
from app.services.kpi_service import KpiService, plan_template_path

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


def _parse_projects(raw: str) -> list[str]:
    text = raw.strip()
    if not text:
        return []
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [str(item).strip() for item in data if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in text.split(",") if item.strip()]


def _build_request(
    role: str,
    period_type: str,
    assignee: str,
    projects: str,
    sprint: str | None,
    month: str | None,
) -> KpiRequest:
    return KpiRequest(
        role=role,
        assignee=assignee,
        projects=_parse_projects(projects),
        period=KpiPeriod(type=period_type, sprint=sprint, month=month),
    )


@router.get("/template")
async def download_kpi_template():
    path = plan_template_path()
    content = path.read_bytes()
    filename = path.name
    filename_star = quote(filename)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename_star}'
            )
        },
    )


@router.post("/calculate", response_model=KpiCalculateResponse)
async def calculate_kpi(
    role: str = Form(default="developer"),
    period_type: str = Form(...),
    assignee: str = Form(...),
    projects: str = Form(...),
    sprint: str | None = Form(default=None),
    month: str | None = Form(default=None),
    workbook: UploadFile | None = File(default=None),
    service: KpiService = Depends(get_kpi_service),
):
    body = _build_request(role, period_type, assignee, projects, sprint, month)
    workbook_bytes = await workbook.read() if workbook else None
    return await service.calculate(body, workbook_bytes=workbook_bytes)


@router.post("/export")
async def export_kpi(
    role: str = Form(default="developer"),
    period_type: str = Form(...),
    assignee: str = Form(...),
    projects: str = Form(...),
    sprint: str | None = Form(default=None),
    month: str | None = Form(default=None),
    workbook: UploadFile | None = File(default=None),
    service: KpiService = Depends(get_kpi_service),
):
    body = _build_request(role, period_type, assignee, projects, sprint, month)
    workbook_bytes = await workbook.read() if workbook else None
    content, calculated = await service.export(body, workbook_bytes=workbook_bytes)
    month_or_sprint = (
        calculated.period.month
        if calculated.period.type == "month"
        else (calculated.period.sprint or "all-project")
    )
    safe_assignee = "".join(
        ch if ch.isascii() and (ch.isalnum() or ch in "-_") else "_"
        for ch in calculated.assignee
    ).strip("_") or "assignee"
    filename = f"KPI_{calculated.role}_{safe_assignee}_{month_or_sprint}.xlsx"
    filename_star = quote(f"KPI_{calculated.role}_{calculated.assignee}_{month_or_sprint}.xlsx")
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename_star}'
            )
        },
    )
