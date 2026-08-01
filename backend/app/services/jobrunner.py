"""Unified long-running job system backed by the JobRun table.

Every long operation (gather, add, dm/group campaigns, validation, warmup,
cleanup, proxy checks...) is a JobRun row. Execution happens either in the RQ
worker (when Redis is available) or in a background thread (inline mode), so
the API always returns immediately and progress is polled via the same
endpoints. Each engine checks the ``control`` column each iteration to support
pause / resume / cancel.
"""
from __future__ import annotations

import json
import threading
import traceback
from datetime import datetime, timezone
from uuid import uuid4

from app.db.models import JobRun
from app.db.session import SessionLocal
from app.services.audit import write_audit_log
from app.services.queue import get_default_queue, queue_available


class JobCancelled(Exception):
    """Raised inside an engine when the job was cancelled by the user."""


class JobPaused(Exception):
    """Internal signal used to park the engine until resumed."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_job_run(
    *,
    kind: str,
    label: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_user_id: int | None = None,
    payload: dict | None = None,
) -> str:
    db = SessionLocal()
    try:
        run = JobRun(
            id=uuid4().hex,
            kind=kind,
            label=label,
            status="queued",
            control="run",
            entity_type=entity_type,
            entity_id=entity_id,
            created_by=actor_user_id,
            progress_json=json.dumps(payload or {}, ensure_ascii=False),
        )
        db.add(run)
        db.commit()
        run_id = run.id
        write_audit_log(
            db,
            action=f"jobs.{kind}.queued",
            message=f"Queued job: {label}",
            actor_user_id=actor_user_id,
            entity_type=entity_type or "job",
            entity_id=entity_id or run_id,
        )
        return run_id
    finally:
        db.close()


def start_job(
    *,
    kind: str,
    label: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_user_id: int | None = None,
    payload: dict | None = None,
) -> str:
    """Create a JobRun and dispatch execution (RQ worker or inline thread)."""
    run_id = create_job_run(
        kind=kind,
        label=label,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    if queue_available():
        try:
            get_default_queue().enqueue(
                "app.tasks.runner.execute_job_run",
                kwargs={"job_run_id": run_id},
                job_timeout=3600 * 8,
                result_ttl=86400 * 7,
            )
            return run_id
        except Exception:
            pass
    # Inline fallback: run in a background thread.
    thread = threading.Thread(target=_thread_runner, args=(run_id,), daemon=True)
    thread.start()
    return run_id


def _thread_runner(run_id: str) -> None:
    try:
        from app.tasks.runner import execute_job_run

        execute_job_run(run_id)
    except Exception:
        db = SessionLocal()
        try:
            run = db.query(JobRun).filter(JobRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error = traceback.format_exc()
                run.ended_at = _now()
                db.add(run)
                db.commit()
        finally:
            db.close()


# --------------------------------------------------------------------------
# Control (used by engines)
# --------------------------------------------------------------------------

def get_control(run_id: str) -> str:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        return run.control if run else "cancel"
    finally:
        db.close()


def wait_if_paused(run_id: str) -> None:
    """Block while the job is paused; raise JobCancelled when cancelled."""
    while True:
        control = get_control(run_id)
        if control == "cancel":
            raise JobCancelled("أُلغيت المهمة")
        if control == "run":
            return
        # paused
        import time

        time.sleep(1)


def update_progress(run_id: str, progress: int, current_step: str | None = None, extra: dict | None = None) -> None:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        if not run:
            return
        run.progress = max(0, min(100, progress))
        if current_step:
            run.current_step = current_step
        if extra:
            try:
                existing = json.loads(run.progress_json or "{}")
            except Exception:
                existing = {}
            existing.update(extra)
            run.progress_json = json.dumps(existing, ensure_ascii=False)
        run.updated_at = _now()
        db.add(run)
        db.commit()
    finally:
        db.close()


def get_progress_payload(run_id: str) -> dict:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        if not run:
            return {}
        try:
            return json.loads(run.progress_json or "{}")
        except Exception:
            return {}
    finally:
        db.close()


def set_progress_payload(run_id: str, payload: dict) -> None:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        if not run:
            return
        run.progress_json = json.dumps(payload, ensure_ascii=False)
        run.updated_at = _now()
        db.add(run)
        db.commit()
    finally:
        db.close()


def finish_job(run_id: str, result: dict | None = None, error: str | None = None) -> None:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        if not run:
            return
        run.status = "failed" if error else "done"
        run.error = error
        if result is not None:
            run.result_json = json.dumps(result, ensure_ascii=False)
        run.progress = 100 if not error else run.progress
        run.ended_at = _now()
        run.updated_at = _now()
        db.add(run)
        db.commit()
    finally:
        db.close()


# --------------------------------------------------------------------------
# Control (used by API)
# --------------------------------------------------------------------------

def set_control(run_id: str, control: str) -> JobRun | None:
    db = SessionLocal()
    try:
        run = db.query(JobRun).filter(JobRun.id == run_id).first()
        if not run:
            return None
        run.control = control
        if control == "cancel" and run.status in ("queued", "running"):
            run.status = "cancelled"
            run.ended_at = _now()
        if control == "pause" and run.status == "running":
            run.status = "paused"
            run.current_step = (run.current_step or "") + " ⏸️ متوقفة مؤقتاً"
        if control == "run" and run.status == "paused":
            run.status = "running"
            run.current_step = (run.current_step or "").replace(" ⏸️ متوقفة مؤقتاً", "")
        run.updated_at = _now()
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
    finally:
        db.close()


def cancel_all_runs() -> int:
    db = SessionLocal()
    try:
        rows = (
            db.query(JobRun)
            .filter(JobRun.status.in_(["queued", "running", "paused"]))
            .all()
        )
        for run in rows:
            run.control = "cancel"
            run.status = "cancelled"
            run.ended_at = _now()
            db.add(run)
        db.commit()
        return len(rows)
    finally:
        db.close()


def get_active_runs() -> list[JobRun]:
    db = SessionLocal()
    try:
        return (
            db.query(JobRun)
            .filter(JobRun.status.in_(["queued", "running", "paused"]))
            .order_by(JobRun.created_at.desc())
            .all()
        )
    finally:
        db.close()


def _get_run(run_id: str) -> JobRun | None:
    db = SessionLocal()
    try:
        return db.query(JobRun).filter(JobRun.id == run_id).first()
    finally:
        db.close()
