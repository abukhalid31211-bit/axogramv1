"""Session import engine: validates .session files / string sessions via
Telethon and creates accounts for the valid ones."""
from __future__ import annotations

import asyncio
import io
import re
import zipfile
from pathlib import Path

from telethon.sessions import StringSession

from app.core.config import get_settings
from app.db.models import Account
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account

settings = get_settings()

STRING_SESSION_RE = re.compile(r"^[1-9A-Za-z_\-]{60,}$")


def _sessions_dir() -> Path:
    path = settings.storage_path / "sessions"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _validate_session_file(db, file_path: Path, api_id: int, api_hash: str) -> tuple[bool, str, dict | None]:
    """Try connecting with the session file. Returns (ok, reason, info)."""
    from app.services.telegram import decrypt_session_file, resolve_encryption_key, session_is_encrypted

    try:
        key = resolve_encryption_key(db)
        real = decrypt_session_file(file_path, key) if (key and session_is_encrypted(file_path)) else file_path
        from telethon import TelegramClient

        client = TelegramClient(str(real), api_id, api_hash)
        asyncio.run(_check(client))
        return True, "صالحة", None
    except Exception as exc:
        return False, str(exc)[:150], None


async def _check(client) -> None:
    await client.connect()
    try:
        me = await client.get_me()
        if me is None:
            raise ValueError("الجلسة غير مصرح بها")
        return me
    finally:
        await client.disconnect()


def sessions_import_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        method = payload.get("method") or "files"  # files | zip | string | text
        actor_user_id = payload.get("actor_user_id")

        api_id, api_hash = get_telegram_credentials(db)
        results: list[dict] = []
        valid = invalid = duplicate = 0
        total = 0

        if method == "files":
            raw_paths = payload.get("paths") or []
            candidates: list[tuple[str, Path | None]] = []
            for raw in raw_paths:
                p = Path(raw)
                if p.is_file():
                    candidates.append((p.name, p))
            total = len(candidates)
            for index, (name, path) in enumerate(candidates):
                jobrunner.wait_if_paused(run_id)
                ok, reason, _ = _validate_session_file(db, path, api_id, api_hash)
                results.append({"file": name, "valid": ok, "reason": reason})
                if ok:
                    status = _register_session(db, path, name, actor_user_id)
                    if status == "duplicate":
                        duplicate += 1
                    else:
                        valid += 1
                else:
                    invalid += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}: {name}")

        elif method == "zip":
            zip_path = payload.get("zip_path")
            password = payload.get("password")
            if not zip_path or not Path(zip_path).exists():
                raise ValueError("ملف ZIP غير موجود")
            try:
                with zipfile.ZipFile(zip_path) as zf:
                    names = [n for n in zf.namelist() if n.endswith(".session")]
                    total = len(names)
                    for index, name in enumerate(names):
                        jobrunner.wait_if_paused(run_id)
                        data = zf.read(name, pwd=password.encode() if password else None)
                        tmp = _sessions_dir() / f"_tmp_{index}_{Path(name).name}"
                        tmp.write_bytes(data)
                        ok, reason, _ = _validate_session_file(db, tmp, api_id, api_hash)
                        results.append({"file": name, "valid": ok, "reason": reason})
                        if ok:
                            status = _register_session(db, tmp, name, actor_user_id, delete_source=True)
                            if status == "duplicate":
                                duplicate += 1
                            else:
                                valid += 1
                        else:
                            invalid += 1
                            tmp.unlink(missing_ok=True)
                        jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}: {name}")
            except RuntimeError as exc:
                raise ValueError(f"تعذر فك ضغط ZIP: {exc}") from exc

        elif method == "string":
            sessions = payload.get("sessions") or []
            total = len(sessions)
            for index, session_string in enumerate(sessions):
                jobrunner.wait_if_paused(run_id)
                session_string = session_string.strip()
                if not STRING_SESSION_RE.match(session_string):
                    results.append({"file": f"StringSession #{index + 1}", "valid": False, "reason": "صيغة غير صالحة"})
                    invalid += 1
                    continue
                try:
                    from telethon import TelegramClient

                    client = TelegramClient(StringSession(session_string), api_id, api_hash)
                    me = asyncio.run(_check(client))
                    # Save as file session for reuse
                    target = _sessions_dir() / f"{(me.phone or 'user_' + str(me.id)).replace('+', 'plus_')}.session"
                    target.unlink(missing_ok=True)
                    _convert_string_to_file(session_string, target, api_id, api_hash)
                    status = _register_session(db, target, target.name, actor_user_id)
                    results.append({"file": target.name, "valid": True, "reason": "صالحة"})
                    if status == "duplicate":
                        duplicate += 1
                    else:
                        valid += 1
                except Exception as exc:
                    results.append({"file": f"StringSession #{index + 1}", "valid": False, "reason": str(exc)[:100]})
                    invalid += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}")

        elif method == "text":
            content = payload.get("content") or ""
            lines = [line.strip() for line in content.splitlines() if line.strip()]
            total = len(lines)
            for index, line in enumerate(lines):
                jobrunner.wait_if_paused(run_id)
                parts = line.split("|")
                if len(parts) < 2:
                    results.append({"file": f"سطر {index + 1}", "valid": False, "reason": "صيغة غير صالحة (متوقع: هاتف|session)"})
                    invalid += 1
                    continue
                phone, session_string = parts[0].strip(), parts[1].strip()
                try:
                    from telethon import TelegramClient

                    client = TelegramClient(StringSession(session_string), api_id, api_hash)
                    me = asyncio.run(_check(client))
                    target = _sessions_dir() / f"{phone.replace('+', 'plus_')}.session"
                    target.unlink(missing_ok=True)
                    _convert_string_to_file(session_string, target, api_id, api_hash)
                    status = _register_session(db, target, target.name, actor_user_id, phone=phone)
                    results.append({"file": phone, "valid": True, "reason": "صالحة"})
                    if status == "duplicate":
                        duplicate += 1
                    else:
                        valid += 1
                except Exception as exc:
                    results.append({"file": phone, "valid": False, "reason": str(exc)[:100]})
                    invalid += 1
                jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}: {phone}")

        else:
            raise ValueError("طريقة استيراد غير معروفة")

        write_audit_log(
            db,
            action="accounts.import.sessions",
            message=f"استيراد جلسات ({method}): {valid} صالحة | {duplicate} مكررة | {invalid} تالفة",
            actor_user_id=actor_user_id,
            entity_type="account",
            entity_id="import",
        )
        return {
            "summary": {"total": total, "valid": valid, "invalid": invalid, "duplicate": duplicate},
            "results": results,
            "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }
    finally:
        db.close()


def _convert_string_to_file(session_string: str, target: Path, api_id: int, api_hash: str) -> None:
    """Convert a string session to a .session file (no OTP required)."""
    from telethon import TelegramClient

    source = TelegramClient(StringSession(session_string), api_id, api_hash)
    source.connect()
    try:
        dest = TelegramClient(str(target), api_id, api_hash)
        dest.session.set_dc(source.session.dc_id, source.session.server_address, source.session.port)
        dest.session.auth_key = source.session.auth_key
        dest.session.save()
    finally:
        source.disconnect()


def _register_session(db, session_path: Path, file_name: str, actor_user_id: int | None, phone: str | None = None, delete_source: bool = False) -> str:
    """Register a validated session file as an account. Returns status."""
    from app.core.config import get_settings as _gs

    existing_by_path = db.query(Account).filter(Account.session_file_path == str(session_path)).first()
    if existing_by_path:
        if delete_source:
            session_path.unlink(missing_ok=True)
        return "duplicate"
    existing_by_phone = db.query(Account).filter(Account.phone == phone).first() if phone else None
    if existing_by_phone:
        existing_by_phone.session_file_path = str(session_path)
        db.add(existing_by_phone)
        db.commit()
        if delete_source:
            session_path.unlink(missing_ok=True)
        return "duplicate"
    account_phone = phone or file_name.replace(".session", "").replace("plus_", "+")
    db.add(Account(phone=account_phone, name=file_name.replace(".session", ""), status="active", session_file_path=str(session_path), last_used_label="الآن (مستورد)", age_label="جديد", owner_user_id=actor_user_id))
    db.commit()
    if delete_source:
        session_path.unlink(missing_ok=True)
    return "created"
