from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func

from app.api.deps import DbSession, check_run_quota, get_current_active_user, require_module
from app.db.models import GatherExport, GatherTemplate, User
from app.schemas.gather import (
    GatherCleanJobPayload,
    GatherExportPublic,
    GatherExtractJobPayload,
    GatherMergeJobPayload,
    GatherStatsResponse,
    GatherTemplateCreate,
    GatherTemplatePublic,
)
from app.schemas.jobs import JobStartResponse
from app.services import jobrunner
from app.services.subscription import is_platform_admin
from app.services.audit import write_audit_log

router = APIRouter(prefix="/gather", tags=["gather"])


@router.get("/exports", response_model=list[GatherExportPublic])
def list_exports(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[GatherExportPublic]:
    query = db.query(GatherExport)
    if not is_platform_admin(current_user):
        query = query.filter(GatherExport.created_by == current_user.id)
    rows = query.order_by(GatherExport.created_at.desc()).all()
    return [GatherExportPublic.model_validate(row) for row in rows]


@router.get("/exports/{export_id}/download")
def download_export(export_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    row = db.query(GatherExport).filter(GatherExport.id == export_id).first()
    if not row or (not is_platform_admin(current_user) and row.created_by != current_user.id):
        raise HTTPException(status_code=404, detail="ملف التصدير غير موجود")
    return FileResponse(path=row.file_path, filename=row.file_name)


@router.delete("/exports/{export_id}")
def delete_export(export_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    row = db.query(GatherExport).filter(GatherExport.id == export_id).first()
    if not row or (not is_platform_admin(current_user) and row.created_by != current_user.id):
        raise HTTPException(status_code=404, detail="ملف التصدير غير موجود")
    db.delete(row)
    db.commit()
    return {"message": "تم حذف ملف التصدير"}


@router.get("/stats", response_model=GatherStatsResponse)
def gather_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GatherStatsResponse:
    total_exports = db.query(func.count(GatherExport.id)).scalar() or 0
    total_members = db.query(func.coalesce(func.sum(GatherExport.member_count), 0)).scalar() or 0
    latest = db.query(GatherExport).order_by(GatherExport.created_at.desc()).first()
    return GatherStatsResponse(total_exports=total_exports, total_members=total_members, latest_export_at=latest.created_at if latest else None)


@router.post("/extract", response_model=JobStartResponse, dependencies=[Depends(require_module("gather"))])
def start_extract(payload: GatherExtractJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    check_run_quota(db, current_user, "gather")
    job_id = jobrunner.start_job(
        kind="gather_extract",
        label=f"تجميع من {payload.source_label}",
        entity_type="gather",
        entity_id="extract",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ التجميع — تابع التقدم من شاشة السجلات", job_id=job_id)


@router.post("/merge", response_model=JobStartResponse, dependencies=[Depends(require_module("gather"))])
def start_merge(payload: GatherMergeJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if len(payload.export_ids) < 1:
        raise HTTPException(status_code=400, detail="اختر ملفاً واحداً على الأقل")
    job_id = jobrunner.start_job(
        kind="gather_merge",
        label=f"دمج {len(payload.export_ids)} ملفات",
        entity_type="gather",
        entity_id="merge",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ الدمج", job_id=job_id)


@router.post("/clean", response_model=JobStartResponse, dependencies=[Depends(require_module("gather"))])
def start_clean(payload: GatherCleanJobPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if not payload.export_id:
        raise HTTPException(status_code=400, detail="اختر ملف التصدير المراد تنظيفه")
    job_id = jobrunner.start_job(
        kind="gather_clean",
        label="تنظيف ملف تصدير",
        entity_type="gather",
        entity_id="clean",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ التنظيف", job_id=job_id)


# ---------- Templates ----------

@router.get("/templates", response_model=list[GatherTemplatePublic])
def list_gather_templates(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[GatherTemplatePublic]:
    rows = db.query(GatherTemplate).order_by(GatherTemplate.created_at.desc()).all()
    return [GatherTemplatePublic.model_validate(row) for row in rows]


@router.post("/templates", response_model=GatherTemplatePublic, status_code=201, dependencies=[Depends(require_module("gather"))])
def create_gather_template(payload: GatherTemplateCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GatherTemplatePublic:
    row = GatherTemplate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return GatherTemplatePublic.model_validate(row)


@router.delete("/templates/{template_id}", dependencies=[Depends(require_module("gather"))])
def delete_gather_template(template_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    row = db.query(GatherTemplate).filter(GatherTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القالب غير موجود")
    db.delete(row)
    db.commit()
    return {"message": "تم حذف القالب"}


@router.get("/jobs/{job_id}")
def gather_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner._get_run(job_id)
    if not run or (not is_platform_admin(current_user) and run.created_by not in (None, current_user.id)):
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return _run_dict(run)


@router.post("/join-private", response_model=JobStartResponse, dependencies=[Depends(require_module("gather"))])
def join_private_group(payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    """Join a private invite link then optionally extract members."""
    link = (payload.get("link") or "").strip()
    if not link:
        raise HTTPException(status_code=400, detail="أدخل رابط الدعوة")
    account_ids = payload.get("account_ids") or []
    auto_leave = payload.get("auto_leave", False)
    # First join, then extract
    job_id = jobrunner.start_job(
        kind="gather_join_private",
        label=f"انضمام + تجميع من {link}",
        entity_type="gather",
        entity_id="join_private",
        actor_user_id=current_user.id,
        payload={"link": link, "account_ids": account_ids, "auto_leave": auto_leave, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ الانضمام والتجميع", job_id=job_id)


@router.post("/search-telegram", response_model=dict, dependencies=[Depends(require_module("gather"))])
def search_telegram(payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    """Search Telegram for groups/channels by keyword via Telethon."""
    query = (payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="أدخل كلمة بحث")
    account_id = payload.get("account_id")
    # Run inline since search is fast
    from app.tasks.gather_tasks import telegram_search_run
    run_id = jobrunner.create_job_run(kind="gather_search", label=f"بحث: {query}", entity_type="gather", actor_user_id=current_user.id, payload={})
    try:
        result = telegram_search_run(run_id, {"query": query, "account_id": account_id, "actor_user_id": current_user.id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _run_dict(run) -> dict:
    import json

    return {
        "job_id": run.id,
        "status": run.status,
        "progress": run.progress,
        "current_step": run.current_step,
        "result": json.loads(run.result_json) if run.result_json else None,
        "error": run.error,
        "enqueued_at": run.created_at,
        "ended_at": run.ended_at,
    }
