from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func

from app.api.deps import DbSession, check_run_quota, get_current_active_user, require_module
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import AddOperation, AppSetting, BlacklistEntry, User
from app.schemas.add import (
    AddDefaultsPayload,
    AddFromExportJobPayload,
    AddManualJobPayload,
    AddOperationPublic,
    AddStatsResponse,
    BlacklistEntryCreate,
    BlacklistEntryPublic,
    MultiSourceAddJobPayload,
    SmartAddJobPayload,
)
from app.schemas.jobs import JobStartResponse
from app.services import jobrunner
from app.services.subscription import is_platform_admin
from app.services.audit import write_audit_log

router = APIRouter(prefix="/add", tags=["add"])

DEFAULT_ADD_SETTINGS = {
    "add_default_delay_from": "60",
    "add_default_delay_to": "120",
    "add_default_switch_from": "5",
    "add_default_switch_to": "10",
    "add_default_daily_limit": "20",
    "add_default_switch_count": "5",
    "add_default_flood_action": "wait",
    "add_default_ban_action": "remove",
    "add_default_privacy_action": "skip",
    "add_default_save_progress": "true",
    "add_default_smart_delay": "false",
    "add_default_smart_limit": "false",
}


@router.get("/operations", response_model=list[AddOperationPublic])
def list_operations(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[AddOperationPublic]:
    query = db.query(AddOperation)
    if not is_platform_admin(current_user):
        query = query.filter(AddOperation.created_by == current_user.id)
    rows = query.order_by(AddOperation.created_at.desc()).all()
    return [AddOperationPublic.model_validate(row) for row in rows]


@router.get("/stats", response_model=AddStatsResponse)
def get_add_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AddStatsResponse:
    total_operations = db.query(func.count(AddOperation.id)).scalar() or 0
    total_success = db.query(func.coalesce(func.sum(AddOperation.success_count), 0)).scalar() or 0
    total_failed = db.query(func.coalesce(func.sum(AddOperation.failed_count), 0)).scalar() or 0
    total_skipped = db.query(func.coalesce(func.sum(AddOperation.skipped_count), 0)).scalar() or 0
    latest = db.query(AddOperation).order_by(AddOperation.created_at.desc()).first()
    return AddStatsResponse(
        total_operations=total_operations,
        total_success=total_success,
        total_failed=total_failed,
        total_skipped=total_skipped,
        latest_operation_at=latest.created_at if latest else None,
    )


@router.post("/from-export", response_model=JobStartResponse, dependencies=[Depends(require_module("add"))])
def start_add_from_export(payload: AddFromExportJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    check_run_quota(db, current_user, "add")
    job_id = jobrunner.start_job(
        kind="add_from_export",
        label=f"إضافة من تصدير إلى {payload.target_label}",
        entity_type="add",
        entity_id="from_export",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت الإضافة — تابع التقدم من سجل العمليات", job_id=job_id)


@router.post("/manual", response_model=JobStartResponse, dependencies=[Depends(require_module("add"))])
def start_add_manual(payload: AddManualJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    check_run_quota(db, current_user, "add")
    if not payload.users:
        raise HTTPException(status_code=400, detail="أدخل مستخدماً واحداً على الأقل")
    job_id = jobrunner.start_job(
        kind="add_manual",
        label=f"إضافة يدوية إلى {payload.target_label}",
        entity_type="add",
        entity_id="manual",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت الإضافة اليدوية", job_id=job_id)


@router.post("/smart", response_model=JobStartResponse, dependencies=[Depends(require_module("add"))])
def start_smart_add(payload: SmartAddJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    check_run_quota(db, current_user, "add")
    job_id = jobrunner.start_job(
        kind="add_smart",
        label=f"إضافة ذكية إلى {payload.target_label}",
        entity_type="add",
        entity_id="smart",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت الإضافة الذكية (تجميع ثم إضافة)", job_id=job_id)


@router.post("/multi-source", response_model=JobStartResponse, dependencies=[Depends(require_module("add"))])
def start_multi_add(payload: MultiSourceAddJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    check_run_quota(db, current_user, "add")
    if not payload.export_ids and not payload.group_links:
        raise HTTPException(status_code=400, detail="اختر ملفات مصدر أو روابط قروبات")
    job_id = jobrunner.start_job(
        kind="add_multi",
        label=f"إضافة متعددة المصادر إلى {payload.target_label}",
        entity_type="add",
        entity_id="multi",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت الإضافة من المصادر المتعددة", job_id=job_id)


@router.get("/defaults")
def get_add_defaults(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    result = {}
    for key, default in DEFAULT_ADD_SETTINGS.items():
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            try:
                result[key] = decrypt_value(row.value_encrypted)
            except Exception:
                result[key] = default
        else:
            result[key] = default
    return result


@router.put("/defaults", dependencies=[Depends(require_module("add"))])
def update_add_defaults(payload: AddDefaultsPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    for key, value in payload.values.items():
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value_encrypted = encrypt_value(str(value))
            db.add(row)
        else:
            db.add(AppSetting(key=key, value_encrypted=encrypt_value(str(value)), is_secret=False))
    db.commit()
    write_audit_log(db, action="add.defaults.update", message="تحديث الإعدادات الافتراضية للإضافة", actor_user_id=current_user.id, entity_type="add", entity_id="defaults")
    return {"message": "تم حفظ الإعدادات الافتراضية"}


@router.get("/blacklist", response_model=list[BlacklistEntryPublic])
def list_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[BlacklistEntryPublic]:
    rows = db.query(BlacklistEntry).order_by(BlacklistEntry.created_at.desc()).all()
    return [BlacklistEntryPublic.model_validate(row) for row in rows]


@router.post("/blacklist", response_model=BlacklistEntryPublic, status_code=201, dependencies=[Depends(require_module("add"))])
def add_blacklist(payload: BlacklistEntryCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> BlacklistEntryPublic:
    value = payload.user_value.strip().lstrip("@")
    if db.query(BlacklistEntry).filter(BlacklistEntry.user_value == value).first():
        raise HTTPException(status_code=409, detail="المستخدم موجود في القائمة السوداء")
    row = BlacklistEntry(user_value=value, reason=payload.reason, created_by=current_user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return BlacklistEntryPublic.model_validate(row)


@router.delete("/blacklist/{entry_id}", dependencies=[Depends(require_module("add"))])
def remove_blacklist(entry_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    row = db.query(BlacklistEntry).filter(BlacklistEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="غير موجود")
    db.delete(row)
    db.commit()
    return {"message": "تمت الإزالة"}


@router.delete("/blacklist", dependencies=[Depends(require_module("add"))])
def clear_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    db.query(BlacklistEntry).delete()
    db.commit()
    return {"message": "تم مسح القائمة السوداء"}


@router.get("/jobs/{job_id}")
def get_add_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.api.routes.gather import _run_dict

    run = jobrunner._get_run(job_id)
    if not run or (not is_platform_admin(current_user) and run.created_by not in (None, current_user.id)):
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return _run_dict(run)
