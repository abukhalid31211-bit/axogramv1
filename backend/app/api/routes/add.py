from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from rq.job import Job
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import AddOperation, AppSetting, BlacklistEntry, User
from app.schemas.add import (
    AddDefaultsPayload,
    AddFromExportJobPayload,
    AddManualJobPayload,
    AddOperationPublic,
    AddStatsResponse,
    AddResult,
    BlacklistEntryCreate,
    BlacklistEntryPublic,
    MultiSourceAddJobPayload,
    SmartAddJobPayload,
)
from app.schemas.jobs import JobStartResponse, JobStatusResponse
from app.services.audit import write_audit_log
from app.services.queue import get_default_queue, queue_available
from app.tasks.add_tasks import add_from_export_job, add_manual_job, multi_source_add_job, smart_add_job

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
    rows = db.query(AddOperation).order_by(AddOperation.created_at.desc()).all()
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


@router.post("/from-export", response_model=JobStartResponse)
def start_add_from_export(payload: AddFromExportJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = add_from_export_job(export_id=payload.export_id, target_label=payload.target_label, method=payload.method, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم تنفيذ الإضافة مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.add_tasks.add_from_export_job",
        kwargs={
            "export_id": payload.export_id,
            "target_label": payload.target_label,
            "method": payload.method,
            "actor_user_id": current_user.id,
        },
        job_timeout=900,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة الإضافة إلى قائمة الانتظار", job_id=job.id)


@router.post("/manual", response_model=JobStartResponse)
def start_add_manual(payload: AddManualJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = add_manual_job(users=payload.users, target_label=payload.target_label, method=payload.method, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم تنفيذ الإضافة اليدوية مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.add_tasks.add_manual_job",
        kwargs={
            "users": payload.users,
            "target_label": payload.target_label,
            "method": payload.method,
            "actor_user_id": current_user.id,
        },
        job_timeout=900,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة الإدخال اليدوي إلى قائمة الانتظار", job_id=job.id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_add_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStatusResponse:
    if not queue_available():
        raise HTTPException(status_code=503, detail="قائمة الانتظار غير متاحة حالياً")
    try:
        job = Job.fetch(job_id, connection=get_default_queue().connection)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة") from exc
    return JobStatusResponse(
        job_id=job.id,
        status=job.get_status(refresh=True),
        result=job.result if isinstance(job.result, dict) else None,
        error=job.exc_info if job.is_failed else None,
        enqueued_at=job.enqueued_at,
        ended_at=job.ended_at,
    )


@router.post("/smart", response_model=JobStartResponse)
def start_smart_add(payload: SmartAddJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = smart_add_job(source_label=payload.source_label, target_label=payload.target_label, method=payload.method, limit=payload.limit, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم تنفيذ الإضافة الذكية مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.add_tasks.smart_add_job",
        kwargs={
            "source_label": payload.source_label,
            "target_label": payload.target_label,
            "method": payload.method,
            "limit": payload.limit,
            "actor_user_id": current_user.id,
        },
        job_timeout=1200,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة الإضافة الذكية إلى قائمة الانتظار", job_id=job.id)


@router.post("/multi-source", response_model=JobStartResponse)
def start_multi_source(payload: MultiSourceAddJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = multi_source_add_job(export_ids=payload.export_ids, group_links=payload.group_links, target_label=payload.target_label, method=payload.method, deduplicate=payload.deduplicate, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم تنفيذ الإضافة من عدة مصادر مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.add_tasks.multi_source_add_job",
        kwargs={
            "export_ids": payload.export_ids,
            "group_links": payload.group_links,
            "target_label": payload.target_label,
            "method": payload.method,
            "deduplicate": payload.deduplicate,
            "actor_user_id": current_user.id,
        },
        job_timeout=1200,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة المصادر المتعددة إلى قائمة الانتظار", job_id=job.id)


@router.get("/defaults")
def get_add_defaults(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    result: dict[str, str] = {}
    for key, default_value in DEFAULT_ADD_SETTINGS.items():
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
          try:
              result[key] = decrypt_value(row.value_encrypted)
          except Exception:
              result[key] = default_value
        else:
          result[key] = default_value
    return result


@router.put("/defaults")
def update_add_defaults(payload: AddDefaultsPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    for key, value in payload.values.items():
        if key not in DEFAULT_ADD_SETTINGS:
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value_encrypted = encrypt_value(value)
            row.is_secret = False
            db.add(row)
        else:
            db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False, description="Add default setting"))
    db.commit()
    write_audit_log(db, action="add.defaults.update", message="Updated add default settings", actor_user_id=current_user.id, entity_type="add_defaults", entity_id="global")
    return {"message": "تم حفظ الإعدادات الافتراضية"}


@router.get("/blacklist", response_model=list[BlacklistEntryPublic])
def list_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[BlacklistEntryPublic]:
    rows = db.query(BlacklistEntry).order_by(BlacklistEntry.created_at.desc()).all()
    return [BlacklistEntryPublic.model_validate(row) for row in rows]


@router.post("/blacklist", response_model=BlacklistEntryPublic)
def create_blacklist_entry(payload: BlacklistEntryCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> BlacklistEntryPublic:
    row = BlacklistEntry(user_value=payload.user_value, reason=payload.reason, created_by=current_user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="add.blacklist.create", message=f"Added {payload.user_value} to blacklist", actor_user_id=current_user.id, entity_type="blacklist", entity_id=str(row.id))
    return BlacklistEntryPublic.model_validate(row)


@router.delete("/blacklist/{entry_id}")
def delete_blacklist_entry(entry_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    row = db.query(BlacklistEntry).filter(BlacklistEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المدخل غير موجود")
    db.delete(row)
    db.commit()
    write_audit_log(db, action="add.blacklist.delete", message=f"Removed blacklist entry {entry_id}", actor_user_id=current_user.id, entity_type="blacklist", entity_id=str(entry_id), level="warn")
    return {"message": "تم حذف المدخل"}


@router.delete("/blacklist")
def clear_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    db.query(BlacklistEntry).delete()
    db.commit()
    write_audit_log(db, action="add.blacklist.clear", message="Cleared blacklist", actor_user_id=current_user.id, entity_type="blacklist", entity_id="all", level="warn")
    return {"message": "تم مسح القائمة السوداء"}
