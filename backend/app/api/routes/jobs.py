from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from rq.job import Job

from app.api.deps import DbSession, get_current_active_user
from app.db.models import User
from app.schemas.jobs import JobStartResponse, JobStatusResponse, ValidateAccountsJobPayload, WarmupAccountsJobPayload
from app.services.queue import get_default_queue, queue_available
from app.tasks.account_tasks import validate_accounts_job, warmup_accounts_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/health")
def jobs_health(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, bool]:
    return {"queue_available": queue_available()}


@router.post("/accounts/validate", response_model=JobStartResponse)
def start_validate_accounts_job(
    payload: ValidateAccountsJobPayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = validate_accounts_job(account_ids=payload.account_ids, actor_user_id=current_user.id)
        return JobStartResponse(mode="finished", message="تم تنفيذ الفحص مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.account_tasks.validate_accounts_job",
        kwargs={"account_ids": payload.account_ids, "actor_user_id": current_user.id},
        job_timeout=600,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة الفحص إلى قائمة الانتظار", job_id=job.id)


@router.post("/accounts/warmup", response_model=JobStartResponse)
def start_warmup_accounts_job(
    payload: WarmupAccountsJobPayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> JobStartResponse:
    if payload.run_inline or not queue_available():
        result = warmup_accounts_job(
            account_ids=payload.account_ids,
            actor_user_id=current_user.id,
            days=payload.days,
            intensity=payload.intensity,
        )
        return JobStartResponse(mode="finished", message="تم تجهيز خطة التهيئة مباشرة", result=result)

    job = get_default_queue().enqueue(
        "app.tasks.account_tasks.warmup_accounts_job",
        kwargs={
            "account_ids": payload.account_ids,
            "actor_user_id": current_user.id,
            "days": payload.days,
            "intensity": payload.intensity,
        },
        job_timeout=600,
        result_ttl=86400,
    )
    return JobStartResponse(mode="queued", message="تمت إضافة مهمة التهيئة إلى قائمة الانتظار", job_id=job.id)


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStatusResponse:
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
