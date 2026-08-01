"""Real security operations via Telethon: device sessions, 2FA, profile edits,
session-file encryption and emergency actions."""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Account, AppSetting
from app.services.audit import write_audit_log
from app.services.settings import get_setting_value
from app.services.telegram import build_client_for_account

settings = get_settings()


async def _client_op(client, op):
    await client.connect()
    try:
        result = op(client)
        if hasattr(result, "__await__"):
            result = await result
        return result
    finally:
        await client.disconnect()


# --------------------------------------------------------------------------
# Device sessions
# --------------------------------------------------------------------------

def get_account_sessions(db: Session, account: Account) -> list[dict]:
    from app.services.settings import get_telegram_credentials
    from telethon.tl.functions.account import GetAuthorizationsRequest

    api_id, api_hash = get_telegram_credentials(db)
    if not account.session_file_path:
        raise ValueError("الحساب لا يملك جلسة تيليجرام")
    client = build_client_for_account(db, account, api_id, api_hash)

    async def _fetch(c):
        result = await c(GetAuthorizationsRequest())
        me = await c.get_me()
        return result, me

    result, me = asyncio.run(_client_op(client, _fetch))
    current_hash = getattr(me, "id", None)
    items = []
    for auth in result.authorizations:
        items.append(
            {
                "hash": str(auth.hash),
                "account_id": account.id,
                "phone": account.phone,
                "device": auth.device_model or "غير معروف",
                "app": auth.app_name or "Telegram",
                "ip": auth.ip or "",
                "last_active": datetime.fromtimestamp(auth.date_active, tz=timezone.utc).strftime("%Y-%m-%d %H:%M") if auth.date_active else "—",
                "suspicious": False,
                "current": bool(getattr(auth, "current", False)),
                "official_app": bool(getattr(auth, "official_app", False)),
            }
        )
    return items


def terminate_account_session(db: Session, account: Account, hash_value: str | None = None, all_others: bool = False) -> int:
    from app.services.settings import get_telegram_credentials
    from telethon.tl.functions.account import ResetAuthorizationRequest

    api_id, api_hash = get_telegram_credentials(db)
    client = build_client_for_account(db, account, api_id, api_hash)

    async def _terminate(c):
        if all_others:
            result = await c(functions_account.GetAuthorizationsRequest())
            count = 0
            for auth in result.authorizations:
                if not getattr(auth, "current", False):
                    await c(ResetAuthorizationRequest(auth.hash))
                    count += 1
            return count
        if not hash_value:
            raise ValueError("حدد الجلسة المراد إنهاؤها")
        await c(ResetAuthorizationRequest(int(hash_value)))
        return 1

    import telethon.tl.functions.account as functions_account

    return asyncio.run(_client_op(client, _terminate))


# --------------------------------------------------------------------------
# 2FA
# --------------------------------------------------------------------------

def change_2fa(db: Session, account: Account, current_password: str | None, new_password: str) -> None:
    """Change/disable the account 2FA password via Telethon. Never stored."""
    from app.services.settings import get_telegram_credentials

    api_id, api_hash = get_telegram_credentials(db)
    client = build_client_for_account(db, account, api_id, api_hash)

    async def _change(c):
        await c.edit_2fa(
            current_password=current_password or None,
            new_password=new_password or None,
        )

    asyncio.run(_client_op(client, _change))


# --------------------------------------------------------------------------
# Profile edits
# --------------------------------------------------------------------------

def update_account_profile(db: Session, account: Account, *, first_name: str | None = None, last_name: str | None = None, bio: str | None = None, username: str | None = None) -> None:
    from app.services.settings import get_telegram_credentials
    from telethon.tl.functions.account import UpdateProfileRequest, UpdateUsernameRequest

    api_id, api_hash = get_telegram_credentials(db)
    client = build_client_for_account(db, account, api_id, api_hash)

    async def _update(c):
        if first_name is not None or last_name is not None or bio is not None:
            await c(UpdateProfileRequest(first_name=first_name or None, last_name=last_name or None, about=bio or None))
        if username is not None:
            await c(UpdateUsernameRequest(username.lstrip("@")))

    asyncio.run(_client_op(client, _update))


def update_account_photo(db: Session, account: Account, photo_path: str) -> None:
    from app.services.settings import get_telegram_credentials
    from telethon.tl.functions.photos import UploadProfilePhotoRequest
    from telethon.tl.types import InputFileLocal

    api_id, api_hash = get_telegram_credentials(db)
    client = build_client_for_account(db, account, api_id, api_hash)

    async def _update(c):
        await c(UploadProfilePhotoRequest(InputFileLocal(photo_path)))

    asyncio.run(_client_op(client, _update))


# --------------------------------------------------------------------------
# Session-file encryption
# --------------------------------------------------------------------------

def _set_setting(db: Session, key: str, value: str) -> None:
    from app.core.crypto import encrypt_value

    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=True))
    db.commit()


def encrypt_all_sessions(db: Session, key: str) -> dict:
    from app.services.telegram import encrypt_session_file

    accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).all()
    encrypted = 0
    failed = []
    for account in accounts:
        path = Path(account.session_file_path or "")
        if not path.exists():
            continue
        try:
            encrypt_session_file(path, key)
            encrypted += 1
        except Exception as exc:
            failed.append(f"{account.phone}: {exc}")
    _set_setting(db, "sessions_encryption", "enabled")
    _set_setting(db, "sessions_encryption_key", key)
    return {"encrypted": encrypted, "failed": failed}


def decrypt_all_sessions(db: Session, key: str) -> dict:
    from app.services.telegram import decrypt_session_file, session_is_encrypted

    accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).all()
    decrypted = 0
    failed = []
    for account in accounts:
        path = Path(account.session_file_path or "")
        if not path.exists() or not session_is_encrypted(path):
            continue
        try:
            # decrypt back into the same file location (temp file -> original)
            tmp = decrypt_session_file(path, key)
            tmp_data = tmp.read_bytes()
            path.write_bytes(tmp_data)
            import shutil

            shutil.rmtree(tmp.parent, ignore_errors=True)
            decrypted += 1
        except Exception as exc:
            failed.append(f"{account.phone}: {exc}")
    _set_setting(db, "sessions_encryption", "disabled")
    return {"decrypted": decrypted, "failed": failed}


# --------------------------------------------------------------------------
# Emergency
# --------------------------------------------------------------------------

def emergency_stop_all(db: Session) -> dict:
    from app.services import jobrunner

    cancelled = jobrunner.cancel_all_runs()
    _set_setting(db, "system_locked", "false")  # stopping, not locking
    write_audit_log(db, action="security.emergency.stop_all", message="إيقاف جميع العمليات الآن", level="critical")
    return {"stopped_jobs": cancelled}


def emergency_lock_system(db: Session) -> dict:
    from app.services import jobrunner

    cancelled = jobrunner.cancel_all_runs()
    _set_setting(db, "system_locked", "true")
    write_audit_log(db, action="security.emergency.lock", message="قفل النظام (إيقاف + منع عمليات جديدة)", level="critical")
    return {"stopped_jobs": cancelled, "locked": True}


def emergency_delete_sessions(db: Session, account_ids: list[int] | None = None) -> dict:
    query = db.query(Account)
    if account_ids:
        query = query.filter(Account.id.in_(account_ids))
    accounts = query.all()
    deleted = 0
    for account in accounts:
        if account.session_file_path:
            try:
                os.remove(account.session_file_path)
                deleted += 1
            except Exception:
                pass
        account.session_file_path = None
        account.status = "restricted"
        account.notes = "حُذفت الجلسة طارئاً"
        db.add(account)
    db.commit()
    write_audit_log(db, action="security.emergency.delete_sessions", message=f"حذف طارئ لـ {deleted} جلسة", level="critical")
    return {"deleted": deleted}


def is_system_locked(db: Session) -> bool:
    return (get_setting_value(db, "system_locked") or "false").lower() in ("true", "1", "yes")
