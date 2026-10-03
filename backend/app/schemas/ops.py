from __future__ import annotations

from pydantic import BaseModel, Field


class OpsWorkType(BaseModel):
    code: str
    label: str


class OpsCaseCreate(BaseModel):
    handler: str = Field(min_length=1)
    handler_display_name: str = Field(min_length=1)
    work_type: str = Field(min_length=1)


class OpsCaseItem(BaseModel):
    id: int
    handler: str
    handler_display_name: str
    work_type: str
    work_type_label: str
    created_at: str


class OpsCaseListResponse(BaseModel):
    items: list[OpsCaseItem]
    total: int


class OpsHandlerStat(BaseModel):
    handler: str
    handler_display_name: str
    total: int
    by_work_type: dict[str, int] = Field(default_factory=dict)


class OpsWorkTypeStat(BaseModel):
    work_type: str
    work_type_label: str
    total: int


class OpsCaseStatsResponse(BaseModel):
    month: str
    total: int
    by_handler: list[OpsHandlerStat]
    by_work_type: list[OpsWorkTypeStat]
