"""Dispatcher that executes a JobRun. Used by the RQ worker and inline threads."""
from __future__ import annotations

import traceback

from app.db.models import JobRun
from app.db.session import SessionLocal
from app.services import jobrunner


def execute_job_run(job_run_id: str) -> None:
    db = SessionLocal()
    run: JobRun | None = None
    try:
        run = db.query(JobRun).filter(JobRun.id == job_run_id).first()
        if not run:
            return
        run.status = "running"
        run.started_at = jobrunner._now()
        run.updated_at = jobrunner._now()
        db.add(run)
        db.commit()
        kind = run.kind
        entity_id = run.entity_id
    finally:
        db.close()

    if not run:
        return

    handler = _get_handler(kind)
    if handler is None:
        jobrunner.finish_job(job_run_id, error=f"لا يوجد منفّذ للمهمة من نوع: {kind}")
        return

    try:
        result = handler(job_run_id, entity_id)
        jobrunner.finish_job(job_run_id, result=result)
    except jobrunner.JobCancelled:
        jobrunner.finish_job(job_run_id, error="تم إلغاء المهمة من المستخدم")
    except Exception as exc:
        jobrunner.finish_job(job_run_id, error=f"{exc}\n{traceback.format_exc()}")
        # Surface critical failures to the audit log as well.
        try:
            from app.services.audit import write_audit_log

            d = SessionLocal()
            try:
                write_audit_log(d, action=f"jobs.{kind}.failed", message=f"Job {job_run_id} failed: {exc}", entity_type="job", entity_id=job_run_id, level="error")
            finally:
                d.close()
        except Exception:
            pass


def _get_handler(kind: str):
    handlers = {
        "gather_extract": _gather_extract,
        "gather_merge": _gather_merge,
        "gather_clean": _gather_clean,
        "add_from_export": _add_from_export,
        "add_manual": _add_manual,
        "add_smart": _add_smart,
        "add_multi": _add_multi,
        "dm_run": _dm_run,
        "group_run": _group_run,
        "campaign_retry": _campaign_retry,
        "accounts_validate": _accounts_validate,
        "accounts_warmup": _accounts_warmup,
        "groups_join": _groups_join,
        "groups_leave": _groups_leave,
        "groups_refresh": _groups_refresh,
        "proxy_validate": _proxy_validate,
        "proxy_replace_dead": _proxy_replace_dead,
        "security_cleanup": _security_cleanup,
        "security_ban_monitor": _security_ban_monitor,
        "sessions_import": _sessions_import,
        "account_profile_bulk": _account_profile_bulk,
        "gather_join_private": _gather_join_private,
        "gather_search": _gather_search,
    }
    return handlers.get(kind)


def _load_payload(run_id: str) -> dict:
    return jobrunner.get_progress_payload(run_id)


def _gather_extract(run_id: str, entity_id: str | None):
    from app.tasks.gather_tasks import gather_extract_run

    payload = _load_payload(run_id)
    return gather_extract_run(run_id, payload)


def _gather_merge(run_id: str, entity_id: str | None):
    from app.tasks.gather_tasks import gather_merge_run

    payload = _load_payload(run_id)
    return gather_merge_run(run_id, payload)


def _gather_clean(run_id: str, entity_id: str | None):
    from app.tasks.gather_tasks import gather_clean_run

    payload = _load_payload(run_id)
    return gather_clean_run(run_id, payload)


def _add_from_export(run_id: str, entity_id: str | None):
    from app.tasks.add_tasks import add_from_export_run

    payload = _load_payload(run_id)
    return add_from_export_run(run_id, payload)


def _add_manual(run_id: str, entity_id: str | None):
    from app.tasks.add_tasks import add_manual_run

    payload = _load_payload(run_id)
    return add_manual_run(run_id, payload)


def _add_smart(run_id: str, entity_id: str | None):
    from app.tasks.add_tasks import add_smart_run

    payload = _load_payload(run_id)
    return add_smart_run(run_id, payload)


def _add_multi(run_id: str, entity_id: str | None):
    from app.tasks.add_tasks import add_multi_run

    payload = _load_payload(run_id)
    return add_multi_run(run_id, payload)


def _dm_run(run_id: str, entity_id: str | None):
    from app.tasks.campaign_tasks import run_dm_campaign

    payload = _load_payload(run_id)
    return run_dm_campaign(run_id, payload)


def _group_run(run_id: str, entity_id: str | None):
    from app.tasks.campaign_tasks import run_group_campaign

    payload = _load_payload(run_id)
    return run_group_campaign(run_id, payload)


def _campaign_retry(run_id: str, entity_id: str | None):
    from app.tasks.campaign_tasks import retry_failed_run

    payload = _load_payload(run_id)
    return retry_failed_run(run_id, payload)


def _accounts_validate(run_id: str, entity_id: str | None):
    from app.tasks.account_tasks import validate_accounts_run

    payload = _load_payload(run_id)
    return validate_accounts_run(run_id, payload)


def _accounts_warmup(run_id: str, entity_id: str | None):
    from app.tasks.account_tasks import warmup_accounts_run

    payload = _load_payload(run_id)
    return warmup_accounts_run(run_id, payload)


def _groups_join(run_id: str, entity_id: str | None):
    from app.tasks.group_tasks import groups_join_run

    payload = _load_payload(run_id)
    return groups_join_run(run_id, payload)


def _groups_leave(run_id: str, entity_id: str | None):
    from app.tasks.group_tasks import groups_leave_run

    payload = _load_payload(run_id)
    return groups_leave_run(run_id, payload)


def _groups_refresh(run_id: str, entity_id: str | None):
    from app.tasks.group_tasks import groups_refresh_run

    payload = _load_payload(run_id)
    return groups_refresh_run(run_id, payload)


def _proxy_validate(run_id: str, entity_id: str | None):
    from app.tasks.proxy_tasks import validate_proxies_run

    payload = _load_payload(run_id)
    return validate_proxies_run(run_id, payload)


def _proxy_replace_dead(run_id: str, entity_id: str | None):
    from app.tasks.proxy_tasks import replace_dead_run

    payload = _load_payload(run_id)
    return replace_dead_run(run_id, payload)


def _security_cleanup(run_id: str, entity_id: str | None):
    from app.tasks.security_tasks import cleanup_accounts_run

    payload = _load_payload(run_id)
    return cleanup_accounts_run(run_id, payload)


def _security_ban_monitor(run_id: str, entity_id: str | None):
    from app.tasks.security_tasks import ban_monitor_run

    payload = _load_payload(run_id)
    return ban_monitor_run(run_id, payload)


def _sessions_import(run_id: str, entity_id: str | None):
    from app.tasks.session_tasks import sessions_import_run

    payload = _load_payload(run_id)
    return sessions_import_run(run_id, payload)


def _account_profile_bulk(run_id: str, entity_id: str | None):
    from app.tasks.account_tasks import profile_bulk_run

    payload = _load_payload(run_id)
    return profile_bulk_run(run_id, payload)


def _gather_join_private(run_id: str, entity_id: str | None):
    from app.tasks.gather_tasks import gather_join_private_run

    payload = _load_payload(run_id)
    return gather_join_private_run(run_id, payload)


def _gather_search(run_id: str, entity_id: str | None):
    from app.tasks.gather_tasks import telegram_search_run

    payload = _load_payload(run_id)
    return telegram_search_run(run_id, payload)
