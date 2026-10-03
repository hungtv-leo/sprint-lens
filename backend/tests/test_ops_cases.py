from pathlib import Path

from app.schemas.ops import OpsCaseCreate
from app.services.ops_case_service import OpsCaseService


def test_ops_case_create_list_and_stats(tmp_path: Path):
    service = OpsCaseService(db_path=tmp_path / "ops_cases.db")

    created = service.create(
        OpsCaseCreate(
            handler="ops.user",
            handler_display_name="Ops User",
            work_type="OP01_SUPPORT",
        )
    )
    assert created.id > 0
    assert created.work_type_label.startswith("Hỗ trợ")

    listed = service.list_cases(limit=10)
    assert listed.total == 1
    assert listed.items[0].handler == "ops.user"

    month = created.created_at[:7]
    stats = service.stats(month)
    assert stats.total == 1
    assert stats.by_handler[0].handler_display_name == "Ops User"
    assert stats.by_work_type[0].work_type == "OP01_SUPPORT"


def test_ops_case_export_excel(tmp_path: Path):
    service = OpsCaseService(db_path=tmp_path / "ops_cases.db")
    created = service.create(
        OpsCaseCreate(
            handler="ops.user",
            handler_display_name="Ops User",
            work_type="OP02_INCIDENT",
        )
    )
    content = service.export_month_excel(created.created_at[:7])
    assert content[:2] == b"PK"
    assert len(content) > 100


def test_ops_case_rejects_invalid_work_type(tmp_path: Path):
    service = OpsCaseService(db_path=tmp_path / "ops_cases.db")
    try:
        service.create(
            OpsCaseCreate(
                handler="ops.user",
                handler_display_name="Ops User",
                work_type="NOT_A_TYPE",
            )
        )
        assert False, "expected HTTPException"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
