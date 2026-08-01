"""Real member-add engine via Telethon: reads recipients, picks accounts via the
rotation service, respects daily limits and error policies, supports
pause/resume/cancel through the unified JobRun system."""
from __future__ import annotations

import asyncio
import csv
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session
from telethon.errors import FloodWaitError, UserPrivacyRestrictedError

from app.core.config import get_settings
from app.db.models import Account, AddOperation, GatherExport
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify
from app.services.rotation import bump_flood, load_op_settings, mark_used, pick_accounts
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account, classify_send_error, is_blacklisted, mark_account_blocked, parse_username

settings = get_settings()


def _read_export_users(db: Session, export_id: int) -> list[dict[str, str]]:
    export = db.query(GatherExport).filter(GatherExport.id == export_id).first()
    if not export:
        raise ValueError("ملف التصدير غير موجود")
    path = Path(export.file_path)
    if not path.exists():
        raise ValueError("ملف التصدير غير موجود على القرص")
    users: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            users.append(
                {
                    "user_id": (row.get("user_id") or "").strip(),
                    "username": (row.get("username") or "").strip(),
                    "phone": (row.get("phone") or "").strip(),
                    "first_name": (row.get("first_name") or "").strip(),
                }
            )
    return users


def _recipient_target(row: dict[str, str]) -> str | None:
    if row.get("username"):
        return parse_username(row["username"])
    if row.get("phone"):
        return parse_username(row["phone"])
    if row.get("user_id") and row["user_id"].isdigit():
        return row["user_id"]
    return None


def _update_operation(db: Session, operation_id: int, status: str, counts: dict) -> None:
    op = db.query(AddOperation).filter(AddOperation.id == operation_id).first()
    if not op:
        return
    op.status = status
    for key, value in counts.items():
        setattr(op, key, value)
    db.add(op)
    db.commit()


def _policy_setting(op_settings: dict, key: str, default: str) -> str:
    return (op_settings.get(key) or default or "wait").strip()


def add_from_export_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        export_id = payload.get("export_id")
        target_label = (payload.get("target_label") or "").strip()
        method = payload.get("method") or "direct"
        actor_user_id = payload.get("actor_user_id")
        if not target_label:
            raise ValueError("حدد المجموعة المستهدفة (رابط أو @username)")
        users = _read_export_users(db, export_id)
        return _run_add_loop(db, run_id, users, target_label, method, actor_user_id)
    finally:
        db.close()


def add_manual_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        target_label = (payload.get("target_label") or "").strip()
        method = payload.get("method") or "direct"
        actor_user_id = payload.get("actor_user_id")
        raw_users = payload.get("users") or []
        if not target_label:
            raise ValueError("حدد المجموعة المستهدفة (رابط أو @username)")
        if not raw_users:
            raise ValueError("أدخل مستخدماً واحداً على الأقل")
        users = [{"user_id": "", "username": u, "phone": "", "first_name": ""} for u in raw_users]
        return _run_add_loop(db, run_id, users, target_label, method, actor_user_id)
    finally:
        db.close()


def add_smart_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        source_label = (payload.get("source_label") or "").strip()
        target_label = (payload.get("target_label") or "").strip()
        method = payload.get("method") or "direct"
        limit = max(1, min(int(payload.get("limit") or 1000), 50000))
        actor_user_id = payload.get("actor_user_id")
        if not source_label:
            raise ValueError("حدد مصدر التجميع (رابط مجموعة)")
        if not target_label:
            raise ValueError("حدد المجموعة المستهدفة")
        from app.tasks.gather_tasks import gather_extract_run

        inner_run = jobrunner.create_job_run(kind="gather_extract", label=f"تجميع ذكي من {source_label}", entity_type="gather", actor_user_id=actor_user_id, payload={"source_label": source_label, "source_type": "smart", "extract_mode": "active", "limit": limit, "account_id": None, "actor_user_id": actor_user_id})
        jobrunner.update_progress(run_id, 3, "جاري التجميع الذكي من المصدر...")
        result = gather_extract_run(inner_run, {"source_label": source_label, "source_type": "smart", "extract_mode": "active", "limit": limit, "account_id": None, "actor_user_id": actor_user_id})
        jobrunner.finish_job(inner_run, result=result)
        users = _read_export_users(db, result["export_id"])
        jobrunner.update_progress(run_id, 10, "بدأت الإضافة...")
        return _run_add_loop(db, run_id, users, target_label, method, actor_user_id, source_label=source_label)
    finally:
        db.close()


def add_multi_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        export_ids = payload.get("export_ids") or []
        group_links = payload.get("group_links") or []
        target_label = (payload.get("target_label") or "").strip()
        method = payload.get("method") or "direct"
        deduplicate = bool(payload.get("deduplicate", True))
        actor_user_id = payload.get("actor_user_id")
        if not target_label:
            raise ValueError("حدد المجموعة المستهدفة")
        if not export_ids and not group_links:
            raise ValueError("اختر ملفات مصدر أو روابط قروبات")

        users: list[dict[str, str]] = []
        if export_ids:
            if len(export_ids) == 1:
                users = _read_export_users(db, export_ids[0])
            else:
                from app.tasks.gather_tasks import gather_merge_run

                inner_run = jobrunner.create_job_run(kind="gather_merge", label="دمج المصادر", entity_type="gather", actor_user_id=actor_user_id, payload={"export_ids": export_ids, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
                jobrunner.update_progress(run_id, 5, "جاري دمج المصادر...")
                merge_result = gather_merge_run(inner_run, {"export_ids": export_ids, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
                jobrunner.finish_job(inner_run, result=merge_result)
                users = _read_export_users(db, merge_result["export_id"])
        if group_links:
            users.extend({"user_id": "", "username": link, "phone": "", "first_name": ""} for link in group_links)
        return _run_add_loop(db, run_id, users, target_label, method, actor_user_id, source_label="متعدد المصادر")
    finally:
        db.close()


def _run_add_loop(db: Session, run_id: str, users: list[dict[str, str]], target_label: str, method: str, actor_user_id: int | None, source_label: str | None = None) -> dict:
    op_settings = load_op_settings(db, "defaults")
    if not users:
        raise ValueError("لا يوجد مستخدمون للإضافة")
    total = len(users)
    delay_from = int(op_settings.get("delay_min") or 60)
    delay_to = int(op_settings.get("delay_max") or 120)
    flood_action = _policy_setting(op_settings, "flood_action", "wait")
    ban_action = _policy_setting(op_settings, "ban_action", "remove")
    privacy_action = _policy_setting(op_settings, "privacy_action", "skip")

    operation = AddOperation(
        source_label=source_label or "manual-input",
        source_type="csv" if source_label else "manual",
        target_label=target_label,
        method=method,
        status="running",
        total_count=total,
        success_count=0,
        skipped_count=0,
        failed_count=0,
        details_json="",
        created_by=actor_user_id,
    )
    db.add(operation)
    db.commit()
    db.refresh(operation)
    operation_id = operation.id

    try:
        api_id, api_hash = get_telegram_credentials(db)
    except ValueError as exc:
        _update_operation(db, operation_id, "failed", {})
        raise ValueError("اضبط Telegram API ID و API Hash من الإعدادات أولاً") from exc

    try:
        return asyncio.run(
            _run_add_loop_async(
                db=db,
                run_id=run_id,
                users=users,
                target_label=target_label,
                operation_id=operation_id,
                total=total,
                delay_from=delay_from,
                delay_to=delay_to,
                flood_action=flood_action,
                ban_action=ban_action,
                privacy_action=privacy_action,
                switch_count=max(1, int(op_settings.get("switch_count") or 5)),
                api_id=api_id,
                api_hash=api_hash,
                actor_user_id=actor_user_id,
                source_label=operation.source_label,
            )
        )
    except Exception as exc:
        _update_operation(db, operation_id, "failed", {})
        raise


async def _run_add_loop_async(
    *,
    db: Session,
    run_id: str,
    users: list[dict[str, str]],
    target_label: str,
    operation_id: int,
    total: int,
    delay_from: int,
    delay_to: int,
    flood_action: str,
    ban_action: str,
    privacy_action: str,
    switch_count: int,
    api_id: int,
    api_hash: str,
    actor_user_id: int | None,
    source_label: str,
) -> dict:
    counts = {"success_count": 0, "skipped_count": 0, "failed_count": 0}
    failure_reasons: dict[str, int] = {}
    current_account: Account | None = None
    client = None
    use_count = 0
    blocked_accounts: set[int] = set()
    from app.services.subscription import assert_user_allows, owner_scope_for

    owner_scope = owner_scope_for(db, actor_user_id)

    jobrunner.update_progress(run_id, 2, f"جاري تجهيز الإضافة إلى {target_label} ({total} مستخدم)")

    from telethon.tl.functions.channels import InviteToChannelRequest

    async def close_client() -> None:
        nonlocal client
        if client is not None:
            try:
                await client.disconnect()
            except Exception:
                pass
            client = None

    async def ensure_client() -> bool:
        nonlocal client, current_account, use_count
        if client is not None and use_count < switch_count:
            return True
        await close_client()
        picked = pick_accounts(db, "add", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope)
        if not picked:
            return False
        current_account = picked[0]
        try:
            client = build_client_for_account(db, current_account, api_id, api_hash)
            await client.connect()
            if not await client.is_user_authorized():
                raise ValueError("الجلسة غير مصرح بها")
        except Exception as exc:
            mark_account_blocked(db, current_account, str(exc)[:120])
            blocked_accounts.add(current_account.id)
            await close_client()
            return False
        use_count = 0
        mark_used(db, current_account, "add", 0)
        return True

    try:
        assert_user_allows(db, actor_user_id, "add")
        for index, row in enumerate(users):
            jobrunner.wait_if_paused(run_id)
            if index % 10 == 0:
                assert_user_allows(db, actor_user_id, "add")
            target = _recipient_target(row)
            if not target:
                counts["skipped_count"] += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تخطي {index + 1}/{total}: بلا معرف صالح")
                continue

            if is_blacklisted(db, target):
                counts["skipped_count"] += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تخطي {index + 1}/{total}: في القائمة السوداء")
                continue

            if not await ensure_client():
                if not pick_accounts(db, "add", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope):
                    raise ValueError("لا يوجد حساب متاح ضمن الحدود اليومية — أضف حسابات أو انتظر تجديد الحدود")
                counts["failed_count"] += 1
                failure_reasons["لا يوجد حساب متاح"] = failure_reasons.get("لا يوجد حساب متاح", 0) + 1
                continue
            use_count += 1
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"إضافة {index + 1}/{total} ({current_account.phone})")

            try:
                entity = await client.get_entity(parse_username(target_label))
                user_entity = await client.get_entity(parse_username(target))
                await client(InviteToChannelRequest(entity, [user_entity]))
                counts["success_count"] += 1
                mark_used(db, current_account, "add", 1)
            except FloodWaitError as exc:
                bump_flood(db, current_account.id)
                wait = int(exc.seconds)
                failure_reasons[f"FloodWait {wait}s"] = failure_reasons.get(f"FloodWait {wait}s", 0) + 1
                if flood_action == "switch":
                    await close_client()
                elif flood_action == "stop":
                    _update_operation(db, operation_id, "paused", counts)
                    raise ValueError(f"إيقاف حسب السياسة: FloodWait {wait} ثانية على {current_account.phone}")
                else:  # wait
                    jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"FloodWait {wait}ث — انتظار...")
                    slept = 0
                    while slept < min(wait, 900):
                        jobrunner.wait_if_paused(run_id)
                        await asyncio.sleep(min(5, wait - slept))
                        slept += 5
                counts["failed_count"] += 1
            except UserPrivacyRestrictedError:
                counts["skipped_count"] += 1
                failure_reasons["خصوصية المستخدم"] = failure_reasons.get("خصوصية المستخدم", 0) + 1
                if privacy_action == "blacklist":
                    from app.db.models import BlacklistEntry

                    if not db.query(BlacklistEntry).filter(BlacklistEntry.user_value == target).first():
                        db.add(BlacklistEntry(user_value=target, reason="خصوصية مغلقة", created_by=actor_user_id))
                        db.commit()
            except Exception as exc:
                category, message = classify_send_error(exc)
                if category == "kicked":
                    counts["skipped_count"] += 1
                    from app.db.models import BlacklistEntry

                    if not db.query(BlacklistEntry).filter(BlacklistEntry.user_value == target).first():
                        db.add(BlacklistEntry(user_value=target, reason="طرد من قروب", created_by=actor_user_id))
                        db.commit()
                    failure_reasons["طرد/حظر من القناة"] = failure_reasons.get("طرد/حظر من القناة", 0) + 1
                elif category == "session":
                    if current_account:
                        mark_account_blocked(db, current_account, message)
                        blocked_accounts.add(current_account.id)
                    await close_client()
                    counts["failed_count"] += 1
                    failure_reasons["جلسة غير صالحة"] = failure_reasons.get("جلسة غير صالحة", 0) + 1
                elif category == "flood":
                    counts["failed_count"] += 1
                    failure_reasons["FloodWait"] = failure_reasons.get("FloodWait", 0) + 1
                else:
                    counts["failed_count"] += 1
                    failure_reasons[message[:60]] = failure_reasons.get(message[:60], 0) + 1
                    if ban_action == "remove" and current_account and "BANNED" in str(exc).upper():
                        mark_account_blocked(db, current_account, str(exc)[:120])
                        blocked_accounts.add(current_account.id)
                        await close_client()

            if counts["failed_count"] > 0 and (index + 1) % 10 == 0:
                _update_operation(db, operation_id, "running", counts)

            delay = random.uniform(delay_from, delay_to)
            slept = 0
            while slept < delay:
                jobrunner.wait_if_paused(run_id)
                await asyncio.sleep(min(2, delay - slept))
                slept += 2

        await close_client()
        _update_operation(db, operation_id, "done", counts)
        final = {
            "operation_id": operation_id,
            "total_count": total,
            "success_count": counts["success_count"],
            "skipped_count": counts["skipped_count"],
            "failed_count": counts["failed_count"],
            "source_label": source_label,
            "target_label": target_label,
            "failure_reasons": failure_reasons,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        write_audit_log(db, action="jobs.add.done", message=f"اكتملت الإضافة إلى {target_label}: ناجح {counts['success_count']} | تخطي {counts['skipped_count']} | فشل {counts['failed_count']}", actor_user_id=actor_user_id, entity_type="add_operation", entity_id=str(operation_id))
        notify(db, event_type="add.done", level="info", title="اكتملت الإضافة", message=f"إلى {target_label}: ✅ {counts['success_count']} | ⚠️ {counts['skipped_count']} | ❌ {counts['failed_count']}")
        return final
    finally:
        await close_client()


# --------------------------------------------------------------------------
# Backward-compatible wrappers
# --------------------------------------------------------------------------

def add_from_export_job(export_id: int, target_label: str, method: str = "direct", actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="add_from_export", label=f"إضافة من تصدير إلى {target_label}", entity_type="add", actor_user_id=actor_user_id, payload={"export_id": export_id, "target_label": target_label, "method": method, "actor_user_id": actor_user_id})
    try:
        result = add_from_export_run(run_id, {"export_id": export_id, "target_label": target_label, "method": method, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise


def add_manual_job(users: list[str], target_label: str, method: str = "direct", actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="add_manual", label=f"إضافة يدوية إلى {target_label}", entity_type="add", actor_user_id=actor_user_id, payload={"users": users, "target_label": target_label, "method": method, "actor_user_id": actor_user_id})
    try:
        result = add_manual_run(run_id, {"users": users, "target_label": target_label, "method": method, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise


def smart_add_job(source_label: str, target_label: str, method: str = "direct", limit: int = 1000, actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="add_smart", label=f"إضافة ذكية إلى {target_label}", entity_type="add", actor_user_id=actor_user_id, payload={"source_label": source_label, "target_label": target_label, "method": method, "limit": limit, "actor_user_id": actor_user_id})
    try:
        result = add_smart_run(run_id, {"source_label": source_label, "target_label": target_label, "method": method, "limit": limit, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise


def multi_source_add_job(export_ids: list[int], group_links: list[str], target_label: str, method: str = "direct", deduplicate: bool = True, actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="add_multi", label=f"إضافة متعددة المصادر إلى {target_label}", entity_type="add", actor_user_id=actor_user_id, payload={"export_ids": export_ids, "group_links": group_links, "target_label": target_label, "method": method, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
    try:
        result = add_multi_run(run_id, {"export_ids": export_ids, "group_links": group_links, "target_label": target_label, "method": method, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise
