"""Real Telegram gather engine: public/private/chat groups, post reactions,
comments and forwards. No synthetic data — failures are surfaced properly."""
from __future__ import annotations

import asyncio
import csv
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session
from telethon.errors import FloodWaitError
from telethon.tl.types import UserStatusLastMonth, UserStatusLastWeek, UserStatusOnline, UserStatusRecently

from app.core.config import get_settings
from app.db.models import Account, GatherExport, GatherTemplate
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify
from app.services.rotation import bump_usage, mark_used, pick_accounts
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account, classify_send_error

settings = get_settings()

POST_RE = re.compile(r"(?:https?://)?t\.me/([^/\s]+)/(\d+)")
GROUP_LINK_RE = re.compile(r"(?:https?://)?t\.me/([^/\s]+)")


def _exports_dir() -> Path:
    path = settings.storage_path / "exports"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write_csv(file_path: Path, rows: list[dict[str, str]]) -> None:
    with file_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["user_id", "first_name", "username", "phone", "last_seen"])
        writer.writeheader()
        writer.writerows(rows)


def _row_from_user(user) -> dict[str, str]:
    username = f"@{user.username}" if getattr(user, "username", None) else ""
    phone = f"+{user.phone}" if getattr(user, "phone", None) else ""
    last_seen = type(getattr(user, "status", None)).__name__ if getattr(user, "status", None) else "unknown"
    first_name = " ".join(part for part in [getattr(user, "first_name", None), getattr(user, "last_name", None)] if part).strip() or "Unknown"
    return {
        "user_id": str(getattr(user, "id", "")),
        "first_name": first_name,
        "username": username,
        "phone": phone,
        "last_seen": last_seen,
    }


def _parse_post_link(source_label: str) -> tuple[str, int] | None:
    match = POST_RE.search(source_label)
    if not match:
        return None
    return match.group(1), int(match.group(2))


async def _telethon_extract(client, source_label: str, extract_mode: str, limit: int, run_id: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    post = _parse_post_link(source_label)
    if extract_mode in ("post_reactions", "post_comments", "post_forwards", "post_views"):
        if not post:
            raise ValueError("رابط المنشور غير صالح — استخدم صيغة t.me/channel/123")
        channel_part, message_id = post
        try:
            entity = await client.get_entity(channel_part)
        except Exception as exc:
            raise ValueError(f"تعذر الوصول للقناة {channel_part}: {exc}") from exc
        message = await client.get_messages(entity, ids=message_id)
        if not message:
            raise ValueError("المنشور غير موجود أو لا يمكن الوصول إليه")

        if extract_mode == "post_views":
            raise ValueError("لا يمكن جمع أسماء المشاهدين — تيليجرام لا يوفر قائمة بالمشاهدين (العدد فقط: " + str(getattr(message, "views", 0)) + ")")

        if extract_mode == "post_reactions":
            from telethon.tl.functions.messages import GetMessageReactionsListRequest

            offset_id = 0
            while len(rows) < limit:
                jobrunner.wait_if_paused(run_id)
                try:
                    result = await client(GetMessageReactionsListRequest(peer=entity, id=message_id, limit=min(100, limit - len(rows)), offset_id=offset_id))
                except FloodWaitError as exc:
                    jobrunner.wait_if_paused(run_id)
                    await asyncio.sleep(min(exc.seconds, 300))
                    continue
                users = result.users or []
                for user in users:
                    rows.append(_row_from_user(user))
                    if len(rows) >= limit:
                        break
                if not users or len(users) < 100:
                    break
                offset_id = users[-1].id
            return rows

        if extract_mode == "post_comments":
            async for msg in client.iter_messages(entity, reply_to=message_id, limit=max(1, limit)):
                jobrunner.wait_if_paused(run_id)
                sender = msg.sender
                if sender is None:
                    continue
                row = _row_from_user(sender)
                row["last_seen"] = "comment"
                rows.append(row)
                if len(rows) >= limit:
                    break
            return rows

        if extract_mode == "post_forwards":
            scanned = 0
            async for msg in client.iter_messages(entity, limit=max(1000, limit * 3)):
                scanned += 1
                jobrunner.wait_if_paused(run_id)
                fwd = getattr(msg, "fwd_from", None)
                if fwd and getattr(fwd, "from_id", None):
                    original = getattr(fwd.from_id, "channel_id", None) or getattr(fwd.from_id, "user_id", None)
                    if str(original) == str(message_id):
                        if msg.sender:
                            row = _row_from_user(msg.sender)
                            row["last_seen"] = "forward"
                            rows.append(row)
                            if len(rows) >= limit:
                                break
            return rows

    # Classic participant gathering (public/private/chat/smart...)
    if source_label.startswith("http") or source_label.startswith("t.me/"):
        entity = await client.get_entity(source_label)
    else:
        entity = await client.get_entity(source_label)
    async for user in client.iter_participants(entity, limit=max(1, limit)):
        jobrunner.wait_if_paused(run_id)
        if extract_mode == "bots" and not getattr(user, "bot", False):
            continue
        if extract_mode == "online" and not isinstance(getattr(user, "status", None), UserStatusOnline):
            continue
        if extract_mode == "active" and not isinstance(getattr(user, "status", None), (UserStatusOnline, UserStatusRecently, UserStatusLastWeek, UserStatusLastMonth)):
            continue
        if extract_mode == "members" and getattr(user, "bot", False):
            continue
        rows.append(_row_from_user(user))
        if len(rows) >= limit:
            break
    return rows


def gather_extract_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        source_label = (payload.get("source_label") or "").strip()
        source_type = payload.get("source_type") or "public"
        extract_mode = payload.get("extract_mode") or "all"
        limit = max(1, min(int(payload.get("limit") or 1000), 100000))
        account_id = payload.get("account_id")
        actor_user_id = payload.get("actor_user_id")

        if not source_label:
            raise ValueError("أدخل رابط أو @username للمجموعة أولاً")
        if extract_mode.startswith("post_") and not POST_RE.search(source_label):
            raise ValueError("رابط المنشور غير صالح — استخدم صيغة t.me/channel/123")

        account = None
        if account_id:
            account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            account = _auto_pick_account(db, "gather")
        if not account:
            raise ValueError("لا يوجد حساب نشط بجلسة تيليجرام متاحة — أضف حساباً أو فعّل حساباً موجوداً")

        api_id, api_hash = get_telegram_credentials(db)
        client = build_client_for_account(db, account, api_id, api_hash)

        jobrunner.update_progress(run_id, 5, f"جاري التجميع من {source_label} عبر {account.phone}...")
        try:
            rows = asyncio.run(_telethon_extract(client, source_label, extract_mode, limit, run_id))
        except ValueError:
            raise
        except Exception as exc:
            category, message = classify_send_error(exc)
            if category == "flood":
                bump_usage(db, account.id, "gather", 0)
                from app.services.rotation import bump_flood

                bump_flood(db, account.id)
            raise ValueError(f"فشل التجميع عبر {account.phone}: {message}") from exc
        finally:
            try:
                asyncio.run(client.disconnect())
            except Exception:
                pass

        if not rows:
            raise ValueError("لم يتم العثور على أي أعضاء (تحقق من صلاحيات الحساب أو الفلاتر المحددة)")

        mark_used(db, account, "gather", amount=len(rows))
        safe_name = source_label.replace("t.me/", "").replace("@", "").replace("/", "_").replace(" ", "_") or "gather"
        file_name = f"gather_{safe_name}_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, rows)

        export_row = GatherExport(
            source_label=source_label,
            source_type=source_type,
            file_name=file_name,
            file_path=str(file_path),
            member_count=len(rows),
            status="ready",
            notes=f"extract_mode={extract_mode}; account={account.phone}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)

        write_audit_log(
            db,
            action="jobs.gather.extract",
            message=f"تم تجميع {len(rows)} عضو من {source_label} عبر {account.phone}",
            actor_user_id=actor_user_id,
            entity_type="gather_export",
            entity_id=str(export_row.id),
        )
        notify(
            db,
            event_type="gather.done",
            level="info",
            title="اكتمل التجميع",
            message=f"تم تجميع {len(rows):,} عضو من {source_label}",
        )
        jobrunner.update_progress(run_id, 100, "اكتمل التجميع")
        return {
            "export_id": export_row.id,
            "file_name": file_name,
            "member_count": len(rows),
            "source_label": source_label,
            "execution_mode": "telethon",
            "account": account.phone,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def _auto_pick_account(db: Session, purpose: str) -> Account | None:
    picked = pick_accounts(db, purpose, count=1)
    return picked[0] if picked else None


def gather_merge_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        export_ids = payload.get("export_ids") or []
        deduplicate = bool(payload.get("deduplicate", True))
        actor_user_id = payload.get("actor_user_id")
        if len(export_ids) < 1:
            raise ValueError("اختر ملفاً واحداً على الأقل للدمج")
        exports = db.query(GatherExport).filter(GatherExport.id.in_(export_ids)).order_by(GatherExport.id.asc()).all()
        if not exports:
            raise ValueError("الملفات المحددة غير موجودة")

        merged_rows: list[dict[str, str]] = []
        seen_ids: set[str] = set()
        jobrunner.update_progress(run_id, 5, "جاري دمج الملفات...")
        for index, export in enumerate(exports):
            jobrunner.wait_if_paused(run_id)
            path = Path(export.file_path)
            if not path.exists():
                continue
            with path.open("r", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    user_id = (row.get("user_id") or "").strip()
                    if deduplicate and user_id:
                        if user_id in seen_ids:
                            continue
                        seen_ids.add(user_id)
                    merged_rows.append(dict(row))
            jobrunner.update_progress(run_id, int((index + 1) / len(exports) * 90), f"دمج {index + 1}/{len(exports)}")

        if not merged_rows:
            raise ValueError("لا توجد صفوف صالحة بعد الدمج")

        file_name = f"merged_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, merged_rows)
        export_row = GatherExport(
            source_label="merge",
            source_type="merge",
            file_name=file_name,
            file_path=str(file_path),
            member_count=len(merged_rows),
            status="ready",
            notes=f"inputs={','.join(str(item.id) for item in exports)}; deduplicate={deduplicate}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)
        write_audit_log(db, action="jobs.gather.merge", message=f"دمج {len(exports)} ملفات إلى {file_name} ({len(merged_rows)} عضو)", actor_user_id=actor_user_id, entity_type="gather_export", entity_id=str(export_row.id))
        jobrunner.update_progress(run_id, 100, "اكتمل الدمج")
        return {
            "export_id": export_row.id,
            "file_name": file_name,
            "input_count": len(exports),
            "member_count": len(merged_rows),
            "deduplicated": deduplicate,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def gather_clean_run(run_id: str, payload: dict) -> dict:
    """Clean an export CSV: dedupe, remove empty rows, optional filters."""
    db = SessionLocal()
    try:
        export_id = payload.get("export_id")
        deduplicate = bool(payload.get("deduplicate", True))
        keep_with_username = bool(payload.get("keep_with_username", False))
        keep_with_phone = bool(payload.get("keep_with_phone", False))
        remove_bots = bool(payload.get("remove_bots", True))
        actor_user_id = payload.get("actor_user_id")

        if not export_id:
            raise ValueError("اختر ملف التصدير المراد تنظيفه")
        export = db.query(GatherExport).filter(GatherExport.id == export_id).first()
        if not export:
            raise ValueError("ملف التصدير غير موجود")
        path = Path(export.file_path)
        if not path.exists():
            raise ValueError("ملف التصدير غير موجود على القرص")

        cleaned: list[dict[str, str]] = []
        seen: set[str] = set()
        removed = 0
        with path.open("r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                jobrunner.wait_if_paused(run_id)
                user_id = (row.get("user_id") or "").strip()
                username = (row.get("username") or "").strip()
                phone = (row.get("phone") or "").strip()
                if not user_id and not username and not phone:
                    removed += 1
                    continue
                if deduplicate and user_id:
                    if user_id in seen:
                        removed += 1
                        continue
                    seen.add(user_id)
                if keep_with_username and not username:
                    removed += 1
                    continue
                if keep_with_phone and not phone:
                    removed += 1
                    continue
                if remove_bots and "bot" in (row.get("first_name") or "").lower():
                    removed += 1
                    continue
                cleaned.append(dict(row))

        if not cleaned:
            raise ValueError("لا توجد صفوف صالحة بعد التنظيف")

        file_name = f"cleaned_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, cleaned)
        export_row = GatherExport(
            source_label=f"cleaned:{export.file_name}",
            source_type="cleaned",
            file_name=file_name,
            file_path=str(file_path),
            member_count=len(cleaned),
            status="ready",
            notes=f"removed={removed}; source_id={export.id}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)
        write_audit_log(db, action="jobs.gather.clean", message=f"تنظيف {export.file_name}: {len(cleaned)} عضو بعد إزالة {removed}", actor_user_id=actor_user_id, entity_type="gather_export", entity_id=str(export_row.id))
        jobrunner.update_progress(run_id, 100, "اكتمل التنظيف")
        return {
            "export_id": export_row.id,
            "file_name": file_name,
            "member_count": len(cleaned),
            "removed": removed,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


# --------------------------------------------------------------------------
# Backward-compatible wrappers (used by older inline call sites)
# --------------------------------------------------------------------------

def gather_extract_job(source_label: str, source_type: str = "public", extract_mode: str = "all", limit: int = 1000, account_id: int | None = None, actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="gather_extract", label=f"تجميع {source_label}", entity_type="gather", actor_user_id=actor_user_id, payload={"source_label": source_label, "source_type": source_type, "extract_mode": extract_mode, "limit": limit, "account_id": account_id, "actor_user_id": actor_user_id})
    try:
        result = gather_extract_run(run_id, {"source_label": source_label, "source_type": source_type, "extract_mode": extract_mode, "limit": limit, "account_id": account_id, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise


def gather_merge_job(export_ids: list[int], deduplicate: bool = True, actor_user_id: int | None = None) -> dict:
    run_id = jobrunner.create_job_run(kind="gather_merge", label="دمج ملفات", entity_type="gather", actor_user_id=actor_user_id, payload={"export_ids": export_ids, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
    try:
        result = gather_merge_run(run_id, {"export_ids": export_ids, "deduplicate": deduplicate, "actor_user_id": actor_user_id})
        jobrunner.finish_job(run_id, result=result)
        return result
    except Exception as exc:
        jobrunner.finish_job(run_id, error=str(exc))
        raise


# --------------------------------------------------------------------------
# Join private group + extract
# --------------------------------------------------------------------------

def gather_join_private_run(run_id: str, payload: dict) -> dict:
    """Join a private invite link, then extract members from the joined group."""
    db = SessionLocal()
    try:
        link = (payload.get("link") or "").strip()
        account_ids = payload.get("account_ids") or []
        auto_leave = bool(payload.get("auto_leave", False))
        actor_user_id = payload.get("actor_user_id")

        if not link:
            raise ValueError("أدخل رابط الدعوة")

        api_id, api_hash = get_telegram_credentials(db)
        accounts = []
        if account_ids:
            accounts = db.query(Account).filter(Account.id.in_(account_ids)).all()
        if not accounts:
            accounts = pick_accounts(db, "gather", count=1)
        if not accounts:
            raise ValueError("لا يوجد حساب متاح للانضمام")

        account = accounts[0]
        client = build_client_for_account(db, account, api_id, api_hash)

        jobrunner.update_progress(run_id, 10, f"جاري الانضمام عبر {account.phone}...")

        from app.services.telegram import parse_username
        from telethon.tl.functions.messages import ImportChatInviteRequest

        entity = None
        async def _join_and_extract():
            nonlocal entity
            await client.connect()
            try:
                invite_hash = link.rstrip("/").split("/")[-1]
                if invite_hash.startswith("+"):
                    invite_hash = invite_hash[1:]
                try:
                    result = await client(ImportChatInviteRequest(invite_hash))
                    entity = result.chats[0] if result.chats else None
                except Exception:
                    entity = await client.get_entity(parse_username(link))
            finally:
                pass

        asyncio.run(_join_and_extract())
        mark_used(db, account, "gather", 1)
        jobrunner.update_progress(run_id, 30, "✅ تم الانضمام — جاري التجميع...")

        rows = asyncio.run(_telethon_extract(client, link, "all", 10000, run_id))

        try:
            asyncio.run(client.disconnect())
        except Exception:
            pass

        if not rows:
            raise ValueError("لم يتم العثور على أعضاء بعد الانضمام")

        safe_name = link.replace("t.me/", "").replace("@", "").replace("/", "_").replace("+", "inv_").replace(" ", "_") or "private"
        file_name = f"gather_private_{safe_name}_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, rows)

        export_row = GatherExport(
            source_label=link, source_type="private", file_name=file_name, file_path=str(file_path),
            member_count=len(rows), status="ready",
            notes=f"joined_via={account.phone}; auto_leave={auto_leave}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)

        if auto_leave and entity:
            try:
                from telethon.tl.functions.channels import LeaveChannelRequest
                async def _leave():
                    await client.connect()
                    try:
                        await client(LeaveChannelRequest(entity))
                    finally:
                        await client.disconnect()
                asyncio.run(_leave())
            except Exception:
                pass

        write_audit_log(db, action="gather.join_private", message=f"انضمام + تجميع من {link}: {len(rows)} عضو", actor_user_id=actor_user_id, entity_type="gather_export", entity_id=str(export_row.id))
        jobrunner.update_progress(run_id, 100, "اكتمل")
        return {
            "export_id": export_row.id, "file_name": file_name, "member_count": len(rows),
            "source_label": link, "execution_mode": "telethon", "joined": True,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


# --------------------------------------------------------------------------
# Telegram search for groups/channels
# --------------------------------------------------------------------------

def telegram_search_run(run_id: str, payload: dict) -> dict:
    """Search Telegram for groups/channels by keyword."""
    db = SessionLocal()
    try:
        query = (payload.get("query") or "").strip()
        account_id = payload.get("account_id")
        actor_user_id = payload.get("actor_user_id")

        if not query:
            raise ValueError("أدخل كلمة بحث")

        account = None
        if account_id:
            account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            account = _auto_pick_account(db, "gather")
        if not account:
            raise ValueError("لا يوجد حساب متاح للبحث")

        api_id, api_hash = get_telegram_credentials(db)
        client = build_client_for_account(db, account, api_id, api_hash)

        results = []
        async def _search():
            await client.connect()
            try:
                from telethon.tl.functions.contacts import SearchRequest
                result = await client(SearchRequest(q=query, limit=20))
                for chat in (result.chats or []):
                    results.append({
                        "name": f"@{chat.username}" if getattr(chat, "username", None) else str(getattr(chat, "title", "?")),
                        "type": "channel" if getattr(chat, "broadcast", False) else "group",
                        "members": str(getattr(chat, "participants_count", 0) or "—"),
                        "description": (getattr(chat, "about", None) or "")[:100],
                        "link": f"https://t.me/{chat.username}" if getattr(chat, "username", None) else "",
                    })
            finally:
                await client.disconnect()

        asyncio.run(_search())
        mark_used(db, account, "gather", 1)

        return {
            "query": query, "results": results, "count": len(results),
            "account": account.phone,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()

