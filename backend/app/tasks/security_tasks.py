"""Security tasks: account cleanup (leave groups, delete contacts, reset
sessions) and the periodic ban monitor."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from app.db.models import Account
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account, classify_send_error


def cleanup_accounts_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        account_ids = payload.get("account_ids") or []
        keep_recent = max(0, int(payload.get("keep_recent_groups") or 0))
        delete_messages_older_days = payload.get("delete_messages_older_days")
        clear_chat_history = bool(payload.get("clear_chat_history", False))
        delete_contacts = bool(payload.get("delete_contacts", False))
        reset_damaged = bool(payload.get("reset_damaged", False))
        clear_cache = bool(payload.get("clear_cache", False))
        actor_user_id = payload.get("actor_user_id")

        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        accounts = [a for a in query.all() if a.session_file_path]
        if not accounts:
            raise ValueError("لا توجد حسابات بجلسات للتنظيف")

        api_id, api_hash = get_telegram_credentials(db)
        summary = {"left_groups": 0, "deleted_messages": 0, "cleared_chats": 0, "deleted_contacts": 0, "reset_sessions": 0, "cleared_cache": 0}
        results: list[dict] = []
        total = len(accounts)

        for index, account in enumerate(accounts):
            jobrunner.wait_if_paused(run_id)
            result = {"phone": account.phone, "actions": []}
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                outcome = asyncio.run(
                    _cleanup_one(
                        client,
                        keep_recent=keep_recent,
                        delete_messages_older_days=delete_messages_older_days,
                        clear_chat_history=clear_chat_history,
                        delete_contacts=delete_contacts,
                    )
                )
                for key in ("left_groups", "deleted_messages", "cleared_chats", "deleted_contacts"):
                    summary[key] += outcome.get(key, 0)
                result["actions"] = [f"مغادرة {outcome['left_groups']} مجموعة", f"حذف {outcome['deleted_messages']} رسالة", f"مسح {outcome['cleared_chats']} محادثة", f"حذف {outcome['deleted_contacts']} جهة اتصال"]
                result["ok"] = True
            except Exception as exc:
                result["ok"] = False
                result["error"] = str(exc)[:120]
            results.append(result)
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تنظيف {index + 1}/{total}: {account.phone}")

        if reset_damaged:
            summary["reset_sessions"] = _reset_damaged_sessions(db, accounts, api_id, api_hash, run_id)
        if clear_cache:
            summary["cleared_cache"] = _clear_local_cache()

        write_audit_log(db, action="security.cleanup.run", message=f"اكتمل التنظيف: {json.dumps(summary, ensure_ascii=False)}", actor_user_id=actor_user_id, entity_type="account", entity_id="cleanup")
        notify(db, event_type="security.cleanup.done", level="info", title="اكتمل تنظيف الحسابات", message="مغادرة {left_groups} مجموعة | حذف {deleted_messages} رسالة".format(**summary))
        return {"summary": summary, "results": results, "generated_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()


async def _cleanup_one(client, *, keep_recent: int, delete_messages_older_days: int | None, clear_chat_history: bool, delete_contacts: bool) -> dict:
    from telethon.tl.functions.contacts import DeleteContactsRequest

    await client.connect()
    outcome = {"left_groups": 0, "deleted_messages": 0, "cleared_chats": 0, "deleted_contacts": 0}
    try:
        dialogs = await client.get_dialogs()
        groups = [d for d in dialogs if d.is_group or d.is_channel]
        if keep_recent > 0 and len(groups) > keep_recent:
            to_leave = groups[keep_recent:]
            for dialog in to_leave:
                try:
                    await client.delete_dialog(dialog.entity)
                    outcome["left_groups"] += 1
                except Exception:
                    pass
        if clear_chat_history:
            for dialog in dialogs:
                if dialog.is_user:
                    try:
                        await client.delete_messages(dialog.entity, await client.get_messages(dialog.entity, limit=200), revoke=True)
                        outcome["cleared_chats"] += 1
                    except Exception:
                        pass
        if delete_contacts:
            contacts = await client.get_contacts()
            if contacts:
                try:
                    await client(DeleteContactsRequest(contacts))
                    outcome["deleted_contacts"] = len(contacts)
                except Exception:
                    pass
        return outcome
    finally:
        await client.disconnect()


def _reset_damaged_sessions(db, accounts: list[Account], api_id: int, api_hash: str, run_id: str) -> int:
    """Delete session files that can no longer connect (will need re-auth)."""
    reset = 0
    from app.services.telegram import build_client_for_account

    for account in accounts:
        try:
            client = build_client_for_account(db, account, api_id, api_hash)
            asyncio.run(_ping(client))
        except Exception:
            import os

            if account.session_file_path:
                try:
                    os.remove(account.session_file_path)
                except Exception:
                    pass
            account.session_file_path = None
            account.status = "restricted"
            account.notes = "جلسة تالفة — أُعيد تعيينها (يلزم إعادة تسجيل الدخول)"
            db.add(account)
            reset += 1
    db.commit()
    return reset


async def _ping(client) -> None:
    await client.connect()
    try:
        await client.get_me()
    finally:
        await client.disconnect()


def _clear_local_cache() -> int:
    import shutil

    from app.core.config import get_settings

    settings = get_settings()
    cache_dir = settings.storage_path / "cache"
    cleared = 0
    if cache_dir.exists():
        for item in cache_dir.iterdir():
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                cleared += 1
            except Exception:
                pass
    return cleared


# --------------------------------------------------------------------------
# Ban monitor
# --------------------------------------------------------------------------

def ban_monitor_run(run_id: str, payload: dict) -> dict:
    """One monitor pass: validate accounts and apply the configured action."""
    db = SessionLocal()
    try:
        from app.services.settings import get_setting_value

        interval = int(get_setting_value(db, "ban_monitor_interval") or 15)
        action = get_setting_value(db, "ban_monitor_action") or "notify"
        actor_user_id = payload.get("actor_user_id")

        accounts = [a for a in db.query(Account).all() if a.session_file_path]
        checked = 0
        banned: list[str] = []
        restricted: list[str] = []
        errors: list[str] = []
        api_id, api_hash = get_telegram_credentials(db)

        for account in accounts:
            jobrunner.wait_if_paused(run_id)
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                me = asyncio.run(_ping(client))
                checked += 1
            except Exception as exc:
                category, message = classify_send_error(exc)
                if category == "session" or "AUTH_KEY" in str(exc).upper():
                    banned.append(account.phone)
                    account.status = "blocked"
                    account.last_used_label = "الآن (حظر)"
                    db.add(account)
                else:
                    restricted.append(account.phone)
                    account.status = "restricted"
                    db.add(account)
                errors.append(f"{account.phone}: {message[:80]}")
            db.commit()

        total = len(banned) + len(restricted)
        if total == 0:
            return {"checked": checked, "banned": [], "restricted": [], "action": action, "message": "لا توجد مشاكل — جميع الحسابات سليمة"}

        message = f"⚠️ مراقب الحظر: {len(banned)} محظور | {len(restricted)} مقيد"
        notify(db, event_type="security.ban_monitor", level="critical" if banned else "warn", title="اكتشاف حظر في الحسابات", message=message + "\n" + "\n".join(errors[:10]))

        if action in ("remove_rotation", "pause_hour", "stop_all"):
            from app.services import jobrunner as jr

            if action == "stop_all":
                jr.cancel_all_runs()
            elif action == "remove_rotation":
                pass  # blocked accounts are excluded by the rotation engine already
            # pause_hour: re-schedule a monitor pass to unpause later is complex;
            # blocked accounts simply stay excluded — engines pick others.

        write_audit_log(db, action="security.ban_monitor.run", message=message, actor_user_id=actor_user_id, entity_type="security", entity_id="ban_monitor", level="warn")
        return {
            "checked": checked,
            "banned": banned,
            "restricted": restricted,
            "action": action,
            "interval_minutes": interval,
            "message": message,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()
