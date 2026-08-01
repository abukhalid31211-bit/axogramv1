"""Real account tasks: validation via Telethon get_me, warm-up plan execution
and bulk profile changes."""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from app.db.models import Account
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account, classify_send_error, mark_account_blocked


async def _client_op(client, op):
    await client.connect()
    try:
        result = op(client)
        if hasattr(result, "__await__"):
            result = await result
        return result
    finally:
        await client.disconnect()


def validate_accounts_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        account_ids = payload.get("account_ids")
        actor_user_id = payload.get("actor_user_id")
        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        accounts = query.order_by(Account.id.asc()).all()
        if not accounts:
            raise ValueError("لا توجد حسابات للفحص")

        api_id, api_hash = get_telegram_credentials(db)
        rows = []
        summary = {"total": len(accounts), "active": 0, "blocked": 0, "restricted": 0, "no_session": 0}
        total = len(accounts)
        jobrunner.update_progress(run_id, 2, f"جاري فحص {total} حساب...")

        for index, account in enumerate(accounts):
            jobrunner.wait_if_paused(run_id)
            if not account.session_file_path:
                rows.append(
                    {
                        "account_id": account.id,
                        "phone": account.phone,
                        "name": account.name,
                        "status": "restricted",
                        "reason": "لا توجد جلسة تيليجرام محفوظة",
                        "last_checked": datetime.now(timezone.utc).isoformat(),
                    }
                )
                summary["no_session"] += 1
                summary["restricted"] += 1
                continue

            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                me = asyncio.run(_client_op(client, lambda c: c.get_me()))
                if me is None:
                    raise ValueError("الجلسة غير مصرح بها")
                account.status = "active"
                account.name = account.name or " ".join(filter(None, [me.first_name, me.last_name])) or account.phone
                account.username = f"@{me.username}" if getattr(me, "username", None) else account.username
                account.telegram_user_id = str(me.id)
                db.add(account)
                db.commit()
                summary["active"] += 1
                rows.append(
                    {
                        "account_id": account.id,
                        "phone": account.phone,
                        "name": account.name,
                        "status": "active",
                        "reason": "الحساب يعمل بشكل طبيعي",
                        "last_checked": datetime.now(timezone.utc).isoformat(),
                    }
                )
            except Exception as exc:
                category, message = classify_send_error(exc)
                is_blocked = category in ("session",) or "AUTH_KEY" in str(exc).upper() or "SESSION" in str(exc).upper()
                status = "blocked" if is_blocked else "restricted"
                if status == "blocked":
                    summary["blocked"] += 1
                    mark_account_blocked(db, account, message)
                else:
                    summary["restricted"] += 1
                    account.status = "restricted"
                    db.add(account)
                    db.commit()
                reason = ("الحساب محظور (جلسة غير صالحة أو محظورة)" if status == "blocked" else "الحساب مقيد (يحتاج تسخيناً)") + f" — {message[:100]}"
                rows.append(
                    {
                        "account_id": account.id,
                        "phone": account.phone,
                        "name": account.name,
                        "status": status,
                        "reason": reason,
                        "last_checked": datetime.now(timezone.utc).isoformat(),
                    }
                )
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}: {account.phone}")

        write_audit_log(
            db,
            action="jobs.accounts.validate",
            message=f"فحص {total} حساب: نشط {summary['active']} | محظور {summary['blocked']} | مقيد {summary['restricted']}",
            actor_user_id=actor_user_id,
            entity_type="job",
            entity_id="accounts.validate",
        )
        notify(
            db,
            event_type="accounts.validated",
            level="info",
            title="اكتمل فحص الحسابات",
            message=f"✅ {summary['active']} نشط | ⛔ {summary['blocked']} محظور | ⚠️ {summary['restricted']} مقيد",
        )
        return {"summary": summary, "rows": rows, "generated_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()


async def _warmup_one(client, steps_per_day: int) -> list[str]:
    me = await client.get_me()
    if me is None:
        raise ValueError("الجلسة غير مصرح بها")
    results = []
    for step_index in range(steps_per_day):
        await asyncio.sleep(random.uniform(3, 8))
        await client.send_message("me", f"تهيئة {step_index + 1}/{steps_per_day} — الحساب يعمل بنشاط طبيعي")
        results.append(f"رسالة إلى Saved Messages ({step_index + 1}/{steps_per_day})")
    return results


def warmup_accounts_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        account_ids = payload.get("account_ids")
        days = max(1, min(int(payload.get("days") or 7), 30))
        intensity = payload.get("intensity") or "medium"
        actor_user_id = payload.get("actor_user_id")

        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        accounts = [a for a in query.all() if a.session_file_path]
        if not accounts:
            raise ValueError("لا توجد حسابات بجلسات تيليجرام للتسخين")

        steps_per_day = {"low": 2, "medium": 4, "high": 7}.get(intensity, 4)
        api_id, api_hash = get_telegram_credentials(db)
        steps: list[dict] = []
        total = len(accounts)
        jobrunner.update_progress(run_id, 2, f"جاري تسخين {total} حساب ({days} يوم)...")

        for index, account in enumerate(accounts):
            jobrunner.wait_if_paused(run_id)
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                actions = asyncio.run(_warmup_one(client, steps_per_day))
                for action in actions:
                    steps.append(
                        {
                            "phone": account.phone,
                            "action": action,
                            "result": f"✅ تم — خطة {days} يوم، كثافة {intensity}",
                        }
                    )
                account.status = "active"
                account.last_used_label = "الآن (تسخين)"
                db.add(account)
                db.commit()
            except Exception as exc:
                steps.append({"phone": account.phone, "action": "تهيئة أولية", "result": f"❌ {str(exc)[:100]}"})
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تسخين {index + 1}/{total}: {account.phone}")

        write_audit_log(db, action="jobs.accounts.warmup", message=f"اكتمل تسخين {len(accounts)} حساب", actor_user_id=actor_user_id, entity_type="job", entity_id="accounts.warmup")
        return {
            "summary": {"target_count": len(accounts), "days": days, "intensity": intensity, "done": len(steps)},
            "steps": steps,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


async def _profile_one(client, first_name: str | None, bio: str | None, photo_path: str | None) -> None:
    if first_name or bio:
        import telethon

        await client(telethon.tl.functions.account.UpdateProfileRequest(first_name=first_name, about=bio))
    if photo_path:
        import glob

        photo_files = sorted(glob.glob(str(photo_path) + "/*"))
        if photo_files:
            from telethon.tl.functions.photos import UploadProfilePhotoRequest
            from telethon.tl.types import InputFileLocal

            await client(UploadProfilePhotoRequest(InputFileLocal(photo_files[0])))


def profile_bulk_run(run_id: str, payload: dict) -> dict:
    """Bulk profile changes: first/last names, bio, photos dir."""
    db = SessionLocal()
    try:
        account_ids = payload.get("account_ids") or []
        names_file = payload.get("names_file")
        bios_file = payload.get("bios_file")
        photos_dir = payload.get("photos_dir")
        actor_user_id = payload.get("actor_user_id")

        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        accounts = [a for a in query.all() if a.session_file_path]
        if not accounts:
            raise ValueError("لا توجد حسابات بجلسات للتعديل")

        names = _read_lines(names_file)
        bios = _read_lines(bios_file)

        api_id, api_hash = get_telegram_credentials(db)
        results = []
        total = len(accounts)
        for index, account in enumerate(accounts):
            jobrunner.wait_if_paused(run_id)
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                asyncio.run(
                    _client_op(
                        client,
                        lambda c, i=index: _profile_one(c, names[i] if i < len(names) else None, bios[i] if i < len(bios) else None, photos_dir),
                    )
                )
                results.append({"phone": account.phone, "action": "تحديث الملف الشخصي", "result": "✅ تم التحديث"})
            except Exception as exc:
                results.append({"phone": account.phone, "action": "تحديث الملف الشخصي", "result": f"❌ {str(exc)[:100]}"})
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تحديث {index + 1}/{total}: {account.phone}")

        write_audit_log(db, action="accounts.profile.bulk", message=f"تحديث ملفات شخصية لـ {len(results)} حساب", actor_user_id=actor_user_id, entity_type="account", entity_id="bulk")
        return {"results": results, "generated_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()


def _read_lines(path_or_name: str | None) -> list[str]:
    if not path_or_name:
        return []
    from pathlib import Path

    from app.core.config import get_settings

    settings = get_settings()
    p = Path(path_or_name)
    if not p.exists():
        candidate = settings.storage_path / "uploads" / p.name
        if candidate.exists():
            p = candidate
        else:
            return []
    try:
        return [line.strip() for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]
    except Exception:
        return []
