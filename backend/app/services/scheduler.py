"""Background scheduler loop: runs due campaign schedules, delivers pending
notifications, processes scheduled message deletions and ticks the ban
monitor. Runs inside the worker process (and as a thread in the API process
when Redis is unavailable)."""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.db.models import CampaignSchedule, NotificationEvent, ScheduledDeletion
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.settings import get_setting_value

settings = get_settings()
POLL_SECONDS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _compute_next_run(pattern: str, next_run: datetime | None) -> datetime | None:
    """Compute the next run based on pattern: one_time|daily|weekly|days|every_x_hours."""
    if pattern == "one_time":
        return None
    now = _now()
    base = next_run or now
    try:
        if pattern == "daily":
            return base + timedelta(days=1)
        if pattern == "weekly":
            return base + timedelta(days=7)
        if pattern.startswith("every_"):
            hours = int(pattern.replace("every_", "").replace("hours", "").strip() or "6")
            return base + timedelta(hours=max(1, hours))
        if pattern.startswith("days:"):
            days = [int(x) for x in pattern.split(":")[1].split(",") if x.strip().isdigit()]
            if days:
                for offset in range(1, 15):
                    candidate = now + timedelta(days=offset)
                    if candidate.isoweekday() in days:
                        return candidate.replace(hour=base.hour, minute=base.minute, second=0, microsecond=0)
            return base + timedelta(days=1)
    except Exception:
        pass
    return base + timedelta(days=1)


def scheduler_tick() -> dict:
    db = SessionLocal()
    try:
        results: dict[str, int] = {"schedules_run": 0, "notifications_delivered": 0, "deletions_processed": 0, "monitor_ticks": 0}
        now = _now()

        # 1) Due campaign schedules
        due = (
            db.query(CampaignSchedule)
            .filter(CampaignSchedule.status == "active", CampaignSchedule.next_run.isnot(None), CampaignSchedule.next_run <= now)
            .all()
        )
        for schedule in due:
            try:
                if schedule.campaign_id:
                    campaign = db.query(__import__("app.db.models", fromlist=["Campaign"]).Campaign).filter(__import__("app.db.models", fromlist=["Campaign"]).Campaign.id == schedule.campaign_id).first()
                    if campaign:
                        kind = "dm_run" if campaign.kind == "dm" else "group_run"
                        jobrunner.start_job(
                            kind=kind,
                            label=f"حملة مجدولة: {campaign.name}",
                            entity_type="campaign",
                            entity_id=str(campaign.id),
                            payload={"campaign_id": campaign.id, "actor_user_id": None},
                        )
                        results["schedules_run"] += 1
                schedule.runs = (schedule.runs or 0) + 1
                schedule.next_run = _compute_next_run(schedule.pattern, schedule.next_run)
                db.add(schedule)
                db.commit()
            except Exception:
                db.rollback()
                continue

        # 2) Pending notifications
        try:
            from app.services.notify import deliver_pending

            results["notifications_delivered"] = deliver_pending(db, limit=10)
        except Exception:
            pass

        # 3) Scheduled deletions
        pending_deletions = db.query(ScheduledDeletion).filter(ScheduledDeletion.status == "pending", ScheduledDeletion.delete_at <= now).limit(20).all()
        for deletion in pending_deletions:
            try:
                from app.db.models import Account
                from app.services.settings import get_telegram_credentials
                from app.services.telegram import build_client_for_account

                account = db.query(Account).filter(Account.id == deletion.account_id).first()
                if account and account.session_file_path:
                    api_id, api_hash = get_telegram_credentials(db)
                    client = build_client_for_account(db, account, api_id, api_hash)
                    import asyncio

                    async def _delete():
                        await client.connect()
                        try:
                            message_ids = json.loads(deletion.message_ids_json or "[]")
                            if message_ids:
                                await client.delete_messages(int(deletion.chat_id), message_ids, revoke=True)
                        finally:
                            await client.disconnect()

                    asyncio.run(_delete())
                    deletion.status = "done"
                else:
                    deletion.status = "failed"
                    deletion.updated_at = _now()
                db.add(deletion)
                db.commit()
                results["deletions_processed"] += 1
            except Exception:
                deletion.status = "failed"
                db.add(deletion)
                db.commit()
                results["deletions_processed"] += 1

        # 3b) Subscription expiry sweep: stop jobs of expired/suspended subscribers
        try:
            from app.services.subscription import sweep_expired_users

            stopped = sweep_expired_users(db)
            if stopped:
                results["expired_jobs_stopped"] = stopped
        except Exception:
            pass

        # 3c) Retention purge (throttled to once per day): delete subscribers
        # whose expiry passed more than `expired_retention_days` ago.
        try:
            last_purge = get_setting_value(db, "admin_purge_last_run")
            purge_due = True
            if last_purge:
                try:
                    purge_due = (now - datetime.fromisoformat(last_purge)).total_seconds() >= 86400
                except Exception:
                    purge_due = True
            if purge_due:
                from app.services.subscription import purge_expired_users

                purged = purge_expired_users(db)
                if purged:
                    results["purged_users"] = purged
                _set_setting(db, "admin_purge_last_run", now.isoformat())
        except Exception:
            pass

        # 4) Ban monitor tick
        if (get_setting_value(db, "ban_monitor_enabled") or "false").lower() in ("true", "1", "yes"):
            last_run = get_setting_value(db, "ban_monitor_last_run")
            interval = int(get_setting_value(db, "ban_monitor_interval") or 15)
            should_run = False
            if not last_run:
                should_run = True
            else:
                try:
                    last = datetime.fromisoformat(last_run)
                    should_run = (now - last).total_seconds() >= interval * 60
                except Exception:
                    should_run = True
            if should_run:
                try:
                    jobrunner.start_job(
                        kind="security_ban_monitor",
                        label="فحص دوري للحظر",
                        entity_type="security",
                        entity_id="ban_monitor",
                        payload={"actor_user_id": None},
                    )
                    results["monitor_ticks"] += 1
                    _set_setting(db, "ban_monitor_last_run", now.isoformat())
                except Exception:
                    pass

        return results
    finally:
        db.close()


def _set_setting(db, key: str, value: str) -> None:
    from app.core.crypto import encrypt_value
    from app.db.models import AppSetting

    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False))
    db.commit()


def scheduler_loop(stop_event: threading.Event | None = None) -> None:
    while True:
        if stop_event and stop_event.is_set():
            return
        try:
            scheduler_tick()
        except Exception:
            pass
        for _ in range(POLL_SECONDS):
            if stop_event and stop_event.is_set():
                return
            time.sleep(1)


def start_scheduler_thread() -> threading.Thread:
    stop_event = threading.Event()
    thread = threading.Thread(target=scheduler_loop, args=(stop_event,), daemon=True)
    thread.start()
    return thread
