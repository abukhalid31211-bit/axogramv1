from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from rq.job import Job
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.db.models import GatherExport, User
from app.schemas.gather import (
    GatherExportPublic,
    GatherExtractJobPayload,
    GatherMergeJobPayload,
    GatherStatsResponse,
)
from app.schemas.jobs import JobStartResponse, JobStatusResponse
from app.services.queue import get_default_queue, queue_available
from app.tasks.gather_tasks import gather_extract_job, gather_merge_job

router = APIRouter(prefix="/gather", tags=["gather"])


@router.get("/exports", response_model=list[GatherExportPublic])
def list_exports(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[GatherExportPublic]:
    rows = db.query(GatherExport).order_by(GatherExport.created_at.desc()).all()
    return [GatherExportPublic.model_validate(row) for row in rows]


@router.get("/exports/{export_id}/download")
def download_export(export_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    row = db.query(GatherExport).filter(GatherExport.id == export_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="ملف التصدير غير موجود")
    return FileResponse(path=row.file_path, filename=row.file_name)


@router.delete("/exports/{export_id}")
def delete_export(export_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    row = db.query(GatherExport).filter(GatherExport.id == export_id).first()
    if not row:
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


@router.post("/extract", response_model=JobStartResponse)
def start_extract(
    payload: GatherExtractJobPayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = gather_extract_job(
            source_label=payload.source_label,
            source_type=payload.source_type,
            extract_mode=payload.extract_mode,
            limit=payload.limit,
            account_id=payload.account_id,
            actor_user_id=current_user.id,
        )
        return JobStartResponse(mode="finished", message="تم تنفيذ التجميع مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.gather_tasks.gather_extract_job",
        kwargs={
            "source_label": payload.source_label,
            "source_type": payload.source_type,
            "extract_mode": payload.extract_mode,
            "limit": payload.limit,
            "account_id": payload.account_id,
            "actor_user_id": current_user.id,
        },
        job_timeout=900,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة التجميع إلى قائمة الانتظار", job_id=job.id)


@router.post("/merge", response_model=JobStartResponse)
def start_merge(
    payload: GatherMergeJobPayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = gather_merge_job(export_ids=payload.export_ids, deduplicate=payload.deduplicate, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم دمج الملفات مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.gather_tasks.gather_merge_job",
        kwargs={
            "export_ids": payload.export_ids,
            "deduplicate": payload.deduplicate,
            "actor_user_id": current_user.id,
        },
        job_timeout=900,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة الدمج إلى قائمة الانتظار", job_id=job.id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def gather_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStatusResponse:
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
