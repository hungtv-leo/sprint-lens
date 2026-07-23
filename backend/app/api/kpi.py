from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.dependencies import get_kpi_service
from app.schemas.kpi import KpiCalculateResponse, KpiRequest
from app.services.kpi_service import KpiService

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


@router.post("/calculate", response_model=KpiCalculateResponse)
async def calculate_kpi(
    body: KpiRequest,
    service: KpiService = Depends(get_kpi_service),
):
    return await service.calculate(body)


@router.post("/export")
async def export_kpi(
    body: KpiRequest,
    service: KpiService = Depends(get_kpi_service),
):
    content, calculated = await service.export(body)
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
