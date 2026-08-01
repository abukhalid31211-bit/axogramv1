from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DbSession, get_current_active_user
from app.db.models import JobRun, User
from app.schemas.jobs import JobRunPublic, JobStartResponse
from app.services import jobrunner
from app.services.queue import queue_available

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _run_dict(run: JobRun) -> dict:
    import json

    return {
        "job_id": run.id,
        "status": run.status,
        "progress": run.progress,
        "current_step": run.current_step,
        "kind": run.kind,
        "label": run.label,
        "progress_json": run.progress_json,
        "result": json.loads(run.result_json) if run.result_json else None,
        "error": run.error,
        "enqueued_at": run.created_at,
        "ended_at": run.ended_at,
    }


@router.get("/health")
def jobs_health(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, bool]:
    return {"queue_available": queue_available()}


# ---------- Unified JobRun endpoints ----------

@router.get("/runs", response_model=list[JobRunPublic])
def list_runs(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    status_value: str | None = None,
    kind: str | None = None,
    limit: int = 50,
) -> list[JobRunPublic]:
    query = db.query(JobRun)
    if status_value:
        query = query.filter(JobRun.status == status_value)
    if kind:
        query = query.filter(JobRun.kind == kind)
    rows = query.order_by(JobRun.created_at.desc()).limit(min(limit, 200)).all()
    return [JobRunPublic.model_validate(row) for row in rows]


@router.get("/runs/{run_id}")
def get_run(run_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner._get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return _run_dict(run)


@router.post("/runs/{run_id}/pause")
def pause_run(run_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner.set_control(run_id, "pause")
    if not run:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return {"message": "تم إيقاف المهمة مؤقتاً", "status": run.status}


@router.post("/runs/{run_id}/resume")
def resume_run(run_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner.set_control(run_id, "run")
    if not run:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return {"message": "تم استئناف المهمة", "status": run.status}


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner.set_control(run_id, "cancel")
    if not run:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return {"message": "تم إلغاء المهمة", "status": run.status}


@router.post("/runs/cancel-all")
def cancel_all_runs(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    count = jobrunner.cancel_all_runs()
    return {"message": f"تم إيقاف {count} مهمة نشطة", "cancelled": count}


# ---------- Legacy RQ endpoints (kept for compatibility) ----------

@router.post("/accounts/validate", response_model=JobStartResponse)
def start_validate_accounts_job(payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="accounts_validate",
        label="فحص جميع الحسابات",
        entity_type="account",
        entity_id="validate",
        actor_user_id=current_user.id,
        payload={"account_ids": payload.get("account_ids"), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ الفحص الشامل للحسابات", job_id=job_id)


@router.post("/accounts/warmup", response_model=JobStartResponse)
def start_warmup_accounts_job(payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="accounts_warmup",
        label="بدء تسخين الحسابات",
        entity_type="account",
        entity_id="warmup",
        actor_user_id=current_user.id,
        payload={"account_ids": payload.get("account_ids"), "days": payload.get("days", 7), "intensity": payload.get("intensity", "medium"), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ التسخين", job_id=job_id)


@router.get("/{job_id}")
def get_job_status(job_id: str, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    run = jobrunner._get_run(job_id)
    if not run:
        raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return _run_dict(run)
