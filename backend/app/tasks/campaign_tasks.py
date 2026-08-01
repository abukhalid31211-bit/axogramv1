"""Real campaign sending engine (DM + group campaigns) via Telethon.

Features: message variables, spin variants, blacklist, flood-wait and slowmode
handling, per-account rotation with daily limits, message deletion scheduling,
final reports with failure reasons and retry-failed support.
"""
from __future__ import annotations

import asyncio
import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session
from telethon.errors import FloodWaitError, SlowModeWaitError

from app.core.config import get_settings
from app.db.models import Account, Campaign, GatherExport, GroupBlacklist, ScheduledDeletion, TargetGroup
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify
from app.services.rotation import bump_flood, load_campaign_settings, mark_used, pick_accounts
from app.services.settings import get_telegram_credentials
from app.services.telegram import (
    build_client_for_account,
    classify_send_error,
    is_blacklisted,
    make_variables,
    mark_account_blocked,
    parse_username,
    render_message,
)

settings = get_settings()


def _load_campaign(db: Session, campaign_id: int) -> Campaign:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError("الحملة غير موجودة")
    return campaign


def _load_groups(db: Session, campaign: Campaign) -> list[dict]:
    """Load target groups from groups_json (list of ids or names) + joined groups."""
    entries: list[dict] = []
    try:
        raw = json.loads(campaign.groups_json or "[]")
    except Exception:
        raw = []
    for item in raw:
        if isinstance(item, dict):
            entries.append(item)
        elif isinstance(item, int) or str(item).isdigit():
            group = db.query(TargetGroup).filter(TargetGroup.id == int(item)).first()
            if group:
                entries.append({"id": group.id, "name": group.name, "members": group.members_count})
        else:
            entries.append({"name": str(item), "members": 0})
    if not entries:
        groups = db.query(TargetGroup).filter(TargetGroup.status == "active").order_by(TargetGroup.members_count.desc()).all()
        entries = [{"id": g.id, "name": g.name, "members": g.members_count} for g in groups]
    return entries


def _load_recipients(db: Session, campaign: Campaign) -> list[dict]:
    """Load DM recipients from recipients_json (source config)."""
    try:
        config = json.loads(campaign.recipients_json or "{}")
    except Exception:
        config = {}
    source_type = config.get("source_type") or "export"
    entries: list[dict] = []
    if source_type == "export" and config.get("export_id"):
        export = db.query(GatherExport).filter(GatherExport.id == int(config["export_id"])).first()
        if not export:
            raise ValueError("ملف المستلمين غير موجود")
        path = Path(export.file_path)
        if not path.exists():
            raise ValueError("ملف المستلمين غير موجود على القرص")
        with path.open("r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                entries.append(
                    {
                        "user_id": (row.get("user_id") or "").strip(),
                        "username": (row.get("username") or "").strip(),
                        "phone": (row.get("phone") or "").strip(),
                        "first_name": (row.get("first_name") or "").strip(),
                    }
                )
    elif source_type == "manual":
        for value in config.get("users") or []:
            entries.append({"username": str(value), "user_id": "", "phone": "", "first_name": ""})
    elif source_type == "group" and config.get("group_id"):
        entries = [{"group_source_id": int(config["group_id"])}]
    return entries


def _resolve_target(recipient: dict) -> str | None:
    if recipient.get("username"):
        return parse_username(recipient["username"])
    if recipient.get("phone"):
        return parse_username(recipient["phone"])
    if recipient.get("user_id") and str(recipient["user_id"]).isdigit():
        return str(recipient["user_id"])
    return None


def _schedule_deletion(db: Session, account: Account, chat_id, message_ids: list[int], delete_after_hours: int | None) -> None:
    if not delete_after_hours or delete_after_hours <= 0 or not message_ids:
        return
    delete_at = datetime.now(timezone.utc) + timedelta(hours=delete_after_hours)
    db.add(
        ScheduledDeletion(
            account_id=account.id,
            chat_id=str(chat_id),
            message_ids_json=json.dumps(message_ids),
            delete_at=delete_at,
            status="pending",
        )
    )
    db.commit()


def run_dm_campaign(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        campaign_id = payload.get("campaign_id")
        actor_user_id = payload.get("actor_user_id")
        failed_only = payload.get("failed_only") or []
        campaign = _load_campaign(db, campaign_id)
        recipients = _load_recipients(db, campaign)

        # group-source recipients: gather members live
        if any(r.get("group_source_id") for r in recipients):
            from app.tasks.gather_tasks import gather_extract_run

            group_id = next(r["group_source_id"] for r in recipients if r.get("group_source_id"))
            group = db.query(TargetGroup).filter(TargetGroup.id == int(group_id)).first()
            if not group:
                raise ValueError("المجموعة المصدر غير موجودة")
            inner_run = jobrunner.create_job_run(kind="gather_extract", label=f"تجميع مستلمين من {group.name}", entity_type="gather", actor_user_id=actor_user_id, payload={"source_label": group.name, "source_type": "group", "extract_mode": "all", "limit": 5000, "account_id": group.account_id, "actor_user_id": actor_user_id})
            jobrunner.update_progress(run_id, 3, "جاري تجميع المستلمين من المجموعة...")
            result = gather_extract_run(inner_run, {"source_label": group.name, "source_type": "group", "extract_mode": "all", "limit": 5000, "account_id": group.account_id, "actor_user_id": actor_user_id})
            jobrunner.finish_job(inner_run, result=result)
            recipients = []
            path = Path(db.query(GatherExport).filter(GatherExport.id == result["export_id"]).first().file_path)
            with path.open("r", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    recipients.append(
                        {
                            "user_id": (row.get("user_id") or "").strip(),
                            "username": (row.get("username") or "").strip(),
                            "phone": (row.get("phone") or "").strip(),
                            "first_name": (row.get("first_name") or "").strip(),
                        }
                    )

        if failed_only:
            recipients = [r for r in recipients if str(r.get("user_id") or r.get("username")) in failed_only]
        if not recipients:
            raise ValueError("لا يوجد مستلمون للحملة — أضف ملف مستلمين أو إدخالاً يدوياً")

        message_template = campaign.message_text or ""
        if not message_template:
            raise ValueError("لا يوجد نص رسالة للحملة")

        ctx = load_campaign_settings(db, campaign)
        delay_min = int(ctx.get("delay_min") or 60)
        delay_max = int(ctx.get("delay_max") or 120)
        switch_count = max(1, int(ctx.get("switch_count") or 10))
        flood_action = ctx.get("flood_action") or "wait"
        delete_after = campaign.delete_after_hours

        campaign.status = "active"
        campaign.total = len(recipients)
        campaign.sent = 0
        campaign.progress = 0
        campaign.started_at = datetime.now(timezone.utc)
        campaign.last_error = None
        db.add(campaign)
        db.commit()

        try:
            api_id, api_hash = get_telegram_credentials(db)
        except ValueError as exc:
            raise ValueError("اضبط Telegram API ID و API Hash من الإعدادات أولاً") from exc

        result = asyncio.run(
            _run_dm_loop(
                db=db,
                run_id=run_id,
                campaign=campaign,
                recipients=recipients,
                message_template=message_template,
                delay_min=delay_min,
                delay_max=delay_max,
                switch_count=switch_count,
                flood_action=flood_action,
                delete_after=delete_after,
                api_id=api_id,
                api_hash=api_hash,
                actor_user_id=actor_user_id,
            )
        )
        return result
    finally:
        db.close()


async def _run_dm_loop(*, db: Session, run_id: str, campaign: Campaign, recipients: list[dict], message_template: str, delay_min: int, delay_max: int, switch_count: int, flood_action: str, delete_after: int | None, api_id: int, api_hash: str, actor_user_id: int | None) -> dict:
    total = len(recipients)
    counts = {"success": 0, "skipped": 0, "failed": 0}
    failure_reasons: dict[str, int] = {}
    account_stats: dict[str, dict] = {}
    failed_list: list[str] = []
    blocked_accounts: set[int] = set()
    spin_variants: dict[str, str] = {}
    current_account: Account | None = None
    client = None
    use_count = 0
    from app.services.subscription import assert_user_allows, owner_scope_for

    owner_scope = owner_scope_for(db, actor_user_id)

    jobrunner.update_progress(run_id, 2, f"جاري تجهيز إرسال {total} رسالة...")

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
        picked = pick_accounts(db, "dm", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope)
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
        mark_used(db, current_account, "dm", 0)
        return True

    try:
        assert_user_allows(db, actor_user_id, "dm")
        for index, recipient in enumerate(recipients):
            jobrunner.wait_if_paused(run_id)
            if index % 10 == 0:
                assert_user_allows(db, actor_user_id, "dm")
            target = _resolve_target(recipient)
            if not target:
                counts["skipped"] += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تخطي {index + 1}/{total}: بلا معرف صالح")
                continue
            if is_blacklisted(db, target):
                counts["skipped"] += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تخطي {index + 1}/{total}: في القائمة السوداء")
                continue

            if not await ensure_client():
                if not pick_accounts(db, "dm", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope):
                    raise ValueError("لا يوجد حساب متاح ضمن الحدود اليومية — أضف حسابات أو انتظر تجديد الحدود")
                counts["failed"] += 1
                failed_list.append(str(recipient.get("user_id") or recipient.get("username") or target))
                continue
            use_count += 1
            variables = make_variables(
                first_name=recipient.get("first_name"),
                username=recipient.get("username") or recipient.get("user_id"),
                phone=recipient.get("phone"),
            )
            message = render_message(message_template, variables, spin_variants)
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"إرسال {index + 1}/{total} إلى {target} عبر {current_account.phone}")

            try:
                sent_msg = await client.send_message(target, message)
                counts["success"] += 1
                mark_used(db, current_account, "dm", 1)
                acc_key = current_account.phone
                account_stats.setdefault(acc_key, {"sent": 0, "failed": 0, "flood": 0})
                account_stats[acc_key]["sent"] += 1
                if sent_msg is not None and getattr(sent_msg, "id", None):
                    _schedule_deletion(db, current_account, sent_msg.chat_id, [sent_msg.id], delete_after)
            except FloodWaitError as exc:
                bump_flood(db, current_account.id)
                account_stats.setdefault(current_account.phone, {"sent": 0, "failed": 0, "flood": 0})
                account_stats[current_account.phone]["flood"] += 1
                counts["failed"] += 1
                failed_list.append(str(recipient.get("user_id") or recipient.get("username") or target))
                failure_reasons[f"FloodWait {exc.seconds}s"] = failure_reasons.get(f"FloodWait {exc.seconds}s", 0) + 1
                if flood_action == "switch":
                    await close_client()
                elif flood_action == "stop":
                    campaign.status = "paused"
                    campaign.last_error = f"إيقاف: FloodWait {exc.seconds}s"
                    db.add(campaign)
                    db.commit()
                    raise ValueError(f"إيقاف حسب السياسة: FloodWait {exc.seconds} ثانية")
                else:
                    jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"FloodWait {exc.seconds}ث — انتظار...")
                    slept = 0
                    while slept < min(int(exc.seconds), 900):
                        jobrunner.wait_if_paused(run_id)
                        await asyncio.sleep(min(5, int(exc.seconds) - slept))
                        slept += 5
            except SlowModeWaitError as exc:
                counts["skipped"] += 1
                failure_reasons["Slowmode"] = failure_reasons.get("Slowmode", 0) + 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"Slowmode {exc.seconds}ث — انتظار...")
                slept = 0
                while slept < min(int(exc.seconds), 900):
                    jobrunner.wait_if_paused(run_id)
                    await asyncio.sleep(min(5, int(exc.seconds) - slept))
                    slept += 5
            except Exception as exc:
                category, message = classify_send_error(exc)
                counts["failed"] += 1
                failed_list.append(str(recipient.get("user_id") or recipient.get("username") or target))
                failure_reasons[message[:60]] = failure_reasons.get(message[:60], 0) + 1
                acc_key = current_account.phone if current_account else "?"
                account_stats.setdefault(acc_key, {"sent": 0, "failed": 0, "flood": 0})
                account_stats[acc_key]["failed"] += 1
                if category == "session" and current_account:
                    mark_account_blocked(db, current_account, message)
                    blocked_accounts.add(current_account.id)
                    await close_client()
                if category == "kicked":
                    counts["failed"] -= 1
                    counts["skipped"] += 1

            campaign.sent = counts["success"]
            campaign.progress = int((index + 1) / total * 100)
            db.add(campaign)
            db.commit()

            delay = random.uniform(delay_min, delay_max)
            slept = 0
            while slept < delay:
                jobrunner.wait_if_paused(run_id)
                await asyncio.sleep(min(2, delay - slept))
                slept += 2

        await close_client()
        return _finish_campaign(db, campaign, counts, failure_reasons, account_stats, failed_list, run_id)
    finally:
        await close_client()


def run_group_campaign(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        campaign_id = payload.get("campaign_id")
        actor_user_id = payload.get("actor_user_id")
        failed_only = payload.get("failed_only") or []
        campaign = _load_campaign(db, campaign_id)
        groups = _load_groups(db, campaign)
        if failed_only:
            groups = [g for g in groups if str(g.get("id")) in failed_only or g.get("name") in failed_only]
        if not groups:
            raise ValueError("لا توجد قروبات مستهدفة — اختر قروبات من إدارة القروبات")

        message_template = campaign.message_text or ""
        if not message_template:
            raise ValueError("لا يوجد نص رسالة للحملة")

        ctx = load_campaign_settings(db, campaign)
        delay_min = int(ctx.get("delay_min") or 60)
        delay_max = int(ctx.get("delay_max") or 120)
        switch_count = max(1, int(ctx.get("switch_count") or 10))
        flood_action = ctx.get("flood_action") or "wait"
        delete_after = campaign.delete_after_hours

        campaign.status = "active"
        campaign.total = len(groups)
        campaign.sent = 0
        campaign.progress = 0
        campaign.started_at = datetime.now(timezone.utc)
        campaign.last_error = None
        db.add(campaign)
        db.commit()

        try:
            api_id, api_hash = get_telegram_credentials(db)
        except ValueError as exc:
            raise ValueError("اضبط Telegram API ID و API Hash من الإعدادات أولاً") from exc

        result = asyncio.run(
            _run_group_loop(
                db=db,
                run_id=run_id,
                campaign=campaign,
                groups=groups,
                message_template=message_template,
                delay_min=delay_min,
                delay_max=delay_max,
                switch_count=switch_count,
                flood_action=flood_action,
                delete_after=delete_after,
                api_id=api_id,
                api_hash=api_hash,
                actor_user_id=actor_user_id,
            )
        )
        return result
    finally:
        db.close()


async def _run_group_loop(*, db: Session, run_id: str, campaign: Campaign, groups: list[dict], message_template: str, delay_min: int, delay_max: int, switch_count: int, flood_action: str, delete_after: int | None, api_id: int, api_hash: str, actor_user_id: int | None) -> dict:
    total = len(groups)
    counts = {"success": 0, "skipped": 0, "failed": 0}
    failure_reasons: dict[str, int] = {}
    account_stats: dict[str, dict] = {}
    failed_groups: list[dict] = []
    blocked_accounts: set[int] = set()
    spin_variants: dict[str, str] = {}
    current_account: Account | None = None
    client = None
    use_count = 0
    from app.services.subscription import assert_user_allows, owner_scope_for

    owner_scope = owner_scope_for(db, actor_user_id)

    jobrunner.update_progress(run_id, 2, f"جاري تجهيز الإرسال إلى {total} قروب...")

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
        picked = pick_accounts(db, "group", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope)
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
        mark_used(db, current_account, "group", 0)
        return True

    try:
        assert_user_allows(db, actor_user_id, "group")
        for index, group in enumerate(groups):
            jobrunner.wait_if_paused(run_id)
            if index % 10 == 0:
                assert_user_allows(db, actor_user_id, "group")
            group_name = group.get("name") or ""
            if not group_name:
                counts["failed"] += 1
                failed_groups.append({"group": str(group.get("id")), "reason": "اسم قروب غير صالح", "attempts": 1})
                continue
            group_link = group_name if group_name.startswith(("http", "t.me/")) else f"https://t.me/{group_name.lstrip('@')}"

            if not await ensure_client():
                if not pick_accounts(db, "group", count=1, exclude_ids=list(blocked_accounts), owner_user_id=owner_scope):
                    raise ValueError("لا يوجد حساب متاح ضمن الحدود اليومية")
                counts["failed"] += 1
                failed_groups.append({"group": group_name, "reason": "لا يوجد حساب متاح", "attempts": 1})
                continue
            use_count += 1
            variables = make_variables(group_name=group_name, group_link=group_link)
            message = render_message(message_template, variables, spin_variants)
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"إرسال إلى {group_name} عبر {current_account.phone}")

            try:
                entity = await client.get_entity(parse_username(group_name))
                result = await client.send_message(entity, message)
                counts["success"] += 1
                mark_used(db, current_account, "group", 1)
                acc_key = current_account.phone
                account_stats.setdefault(acc_key, {"sent": 0, "failed": 0, "flood": 0})
                account_stats[acc_key]["sent"] += 1
                if getattr(result, "id", None):
                    _schedule_deletion(db, current_account, entity.id, [result.id], delete_after)
                if campaign.auto_leave_new_groups:
                    try:
                        await client.delete_dialog(entity)
                    except Exception:
                        pass
            except FloodWaitError as exc:
                bump_flood(db, current_account.id)
                counts["failed"] += 1
                failed_groups.append({"group": group_name, "reason": f"FloodWait {exc.seconds}s", "attempts": 1})
                failure_reasons[f"FloodWait {exc.seconds}s"] = failure_reasons.get(f"FloodWait {exc.seconds}s", 0) + 1
                if flood_action == "switch":
                    await close_client()
                elif flood_action == "stop":
                    campaign.status = "paused"
                    campaign.last_error = f"إيقاف: FloodWait {exc.seconds}s"
                    db.add(campaign)
                    db.commit()
                    raise ValueError(f"إيقاف حسب السياسة: FloodWait {exc.seconds} ثانية")
                else:
                    slept = 0
                    while slept < min(int(exc.seconds), 900):
                        jobrunner.wait_if_paused(run_id)
                        await asyncio.sleep(min(5, int(exc.seconds) - slept))
                        slept += 5
            except Exception as exc:
                category, message = classify_send_error(exc)
                if category == "kicked":
                    counts["skipped"] += 1
                    if not db.query(GroupBlacklist).filter(GroupBlacklist.group_value == group_name).first():
                        db.add(GroupBlacklist(group_value=group_name, reason="طرد من القروب", created_by=actor_user_id))
                        db.commit()
                    group_row = db.query(TargetGroup).filter(TargetGroup.id == group.get("id")).first() if group.get("id") else None
                    if group_row:
                        group_row.status = "blocked"
                        db.add(group_row)
                        db.commit()
                    failure_reasons["طرد من قروب"] = failure_reasons.get("طرد من قروب", 0) + 1
                elif category == "slowmode":
                    counts["skipped"] += 1
                    failure_reasons["Slowmode"] = failure_reasons.get("Slowmode", 0) + 1
                else:
                    counts["failed"] += 1
                    failed_groups.append({"group": group_name, "reason": message[:120], "attempts": 1})
                    failure_reasons[message[:60]] = failure_reasons.get(message[:60], 0) + 1
                    if category == "session" and current_account:
                        mark_account_blocked(db, current_account, message)
                        blocked_accounts.add(current_account.id)
                        await close_client()

            campaign.sent = counts["success"]
            campaign.progress = int((index + 1) / total * 100)
            db.add(campaign)
            db.commit()

            delay = random.uniform(delay_min, delay_max)
            slept = 0
            while slept < delay:
                jobrunner.wait_if_paused(run_id)
                await asyncio.sleep(min(2, delay - slept))
                slept += 2

        await close_client()
        return _finish_campaign(db, campaign, counts, failure_reasons, account_stats, failed_groups, run_id)
    finally:
        await close_client()


def retry_failed_run(run_id: str, payload: dict) -> dict:
    campaign_id = payload.get("campaign_id")
    failed_only = payload.get("failed_only") or []
    actor_user_id = payload.get("actor_user_id")
    db = SessionLocal()
    try:
        campaign = _load_campaign(db, campaign_id)
    finally:
        db.close()
    if campaign.kind == "dm":
        result = run_dm_campaign(run_id, {"campaign_id": campaign_id, "actor_user_id": actor_user_id, "failed_only": failed_only})
    else:
        result = run_group_campaign(run_id, {"campaign_id": campaign_id, "actor_user_id": actor_user_id, "failed_only": failed_only})
    result["retried"] = True
    return result


def _finish_campaign(db: Session, campaign: Campaign, counts: dict, failure_reasons: dict, account_stats: dict, failed_items: list, run_id: str) -> dict:
    campaign.status = "done"
    campaign.progress = 100
    campaign.sent = counts["success"]
    campaign.finished_at = datetime.now(timezone.utc)
    db.add(campaign)
    db.commit()

    started = campaign.started_at or campaign.finished_at or datetime.now(timezone.utc)
    duration = max(0, (campaign.finished_at - started).total_seconds() / 60)
    report = {
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "success": counts["success"],
        "skipped": counts["skipped"],
        "failed": counts["failed"],
        "total": counts["success"] + counts["skipped"] + counts["failed"],
        "failure_reasons": failure_reasons,
        "per_account": account_stats,
        "failed_items": failed_items[:500],
        "duration_minutes": round(duration, 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_audit_log(
        db,
        action=f"campaigns.{campaign.kind}.done",
        message=f"اكتملت حملة {campaign.name}: ✅ {counts['success']} | ⚠️ {counts['skipped']} | ❌ {counts['failed']}",
        entity_type="campaign",
        entity_id=str(campaign.id),
    )
    notify(
        db,
        event_type="campaign.done",
        level="info",
        title=f"اكتملت الحملة: {campaign.name}",
        message=f"✅ {counts['success']} | ⚠️ {counts['skipped']} | ❌ {counts['failed']}",
    )
    jobrunner.update_progress(run_id, 100, "اكتملت الحملة")
    return report
