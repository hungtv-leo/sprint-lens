from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.dependencies import get_ops_case_service
from app.schemas.ops import (
    OpsCaseCreate,
    OpsCaseItem,
    OpsCaseListResponse,
    OpsCaseStatsResponse,
    OpsWorkType,
)
from app.services.ops_case_service import OpsCaseService

router = APIRouter(prefix="/api/ops", tags=["ops"])


@router.get("/work-types", response_model=list[OpsWorkType])
async def list_work_types(service: OpsCaseService = Depends(get_ops_case_service)):
    return service.list_work_types()


@router.get("/cases/stats", response_model=OpsCaseStatsResponse)
async def case_stats(
    month: str = Query(..., description="YYYY-MM"),
    service: OpsCaseService = Depends(get_ops_case_service),
):
    return service.stats(month)


@router.get("/cases/export")
async def export_cases(
    month: str = Query(..., description="YYYY-MM"),
    service: OpsCaseService = Depends(get_ops_case_service),
):
    content = service.export_month_excel(month)
    filename = f"ops_cases_{month}.xlsx"
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


@router.post("/cases", response_model=OpsCaseItem)
async def create_case(
    body: OpsCaseCreate,
    service: OpsCaseService = Depends(get_ops_case_service),
):
    return service.create(body)


@router.get("/cases", response_model=OpsCaseListResponse)
async def list_cases(
    month: str | None = Query(default=None),
    handler: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=10_000),
    service: OpsCaseService = Depends(get_ops_case_service),
):
    return service.list_cases(month=month, handler=handler, limit=limit)
