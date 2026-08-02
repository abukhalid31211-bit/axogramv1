"""Telegram helpers: client building (proxy + encrypted sessions), message
rendering (variables + spin), entity resolution and safe send helpers."""
from __future__ import annotations

import json
import random
import re
import tempfile
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import (
    ChatWriteForbiddenError,
    FloodWaitError,
    SlowModeWaitError,
    UserBannedInChannelError,
    UserPrivacyRestrictedError,
    UserKickedError,
)

from app.core.config import get_settings
from app.db.models import Account, Proxy
from app.services.settings import get_telegram_credentials
from app.services.telegram_auth import phone_to_session_path

settings = get_settings()

ENC_HEADER = b"AXOGRAM_ENC_V1:"

# --------------------------------------------------------------------------
# Session encryption
# --------------------------------------------------------------------------

def _fernet_from_key(key: str):
    import base64
    import hashlib

    from cryptography.fernet import Fernet

    seed = hashlib.sha256(key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(seed))


def encrypt_session_file(path: str | Path, key: str) -> None:
    p = Path(path)
    if not p.exists():
        return
    data = p.read_bytes()
    if data.startswith(ENC_HEADER):
        return
    fernet = _fernet_from_key(key)
    encrypted = ENC_HEADER + fernet.encrypt(data)
    p.write_bytes(encrypted)


def decrypt_session_file(path: str | Path, key: str) -> Path:
    """Decrypt an encrypted session file to a temp file and return its path."""
    p = Path(path)
    data = p.read_bytes()
    if not data.startswith(ENC_HEADER):
        return p
    fernet = _fernet_from_key(key)
    raw = fernet.decrypt(data[len(ENC_HEADER):])
    tmp = Path(tempfile.mkdtemp(prefix="axo_sess_")) / p.name
    tmp.write_bytes(raw)
    return tmp


def session_is_encrypted(path: str | Path) -> bool:
    p = Path(path)
    if not p.exists():
        return False
    try:
        return p.read_bytes().startswith(ENC_HEADER)
    except Exception:
        return False


def resolve_encryption_key(db: Session) -> str | None:
    from app.services.settings import get_setting_value

    key = get_setting_value(db, "sessions_encryption_key")
    if key:
        return key
    return settings.encryption_key or settings.secret_key


# --------------------------------------------------------------------------
# Client building
# --------------------------------------------------------------------------

def _proxy_kwargs(proxy: Proxy | None) -> dict:
    if not proxy:
        return {}
    host, port = proxy.address.rsplit(":", 1)
    try:
        port = int(port)
    except ValueError:
        return {}
    auth = (proxy.auth_login, proxy.auth_password) if proxy.auth_login else None
    ptype = (proxy.proxy_type or "SOCKS5").upper()
    if ptype in ("HTTP", "HTTPS"):
        return {"proxy": ("http", host, port, auth)}
    if ptype == "SOCKS4":
        return {"proxy": ("socks4", host, port, auth)}
    return {"proxy": ("socks5", host, port, auth)}


def build_client_for_account(db: Session, account: Account, api_id: int | None = None, api_hash: str | None = None) -> TelegramClient:
    from app.services.settings import get_setting_value

    if get_setting_value(db, "accounts_frozen") == "true":
        raise ValueError("الحسابات مجمّدة مؤقتاً لدواعي الأمان ومنعاً للحظر")

    if not account.session_file_path:
        raise ValueError("الحساب لا يملك جلسة تيليجرام محفوظة")
    session_path = Path(account.session_file_path)
    if not session_path.exists():
        raise ValueError("ملف الجلسة غير موجود على القرص")
    if api_id is None or api_hash is None:
        api_id, api_hash = get_telegram_credentials(db)
    key = resolve_encryption_key(db)
    real_path = decrypt_session_file(session_path, key) if (key and session_is_encrypted(session_path)) else session_path
    proxy = db.query(Proxy).filter(Proxy.id == account.proxy_id).first() if account.proxy_id else None
    return TelegramClient(str(real_path), api_id, api_hash, **_proxy_kwargs(proxy), device_model="Axogram Pro", app_version="1.0.0")


def build_bot_client(token: str, api_id: int | None = None, api_hash: str | None = None, db: Session | None = None) -> TelegramClient:
    # Fall back to the platform-wide credentials (admin panel → env vars).
    if not api_id or not api_hash:
        if db is not None:
            try:
                api_id, api_hash = get_telegram_credentials(db)
            except Exception:
                api_id, api_hash = None, None
        if not api_id or not api_hash:
            try:
                from app.core.config import get_settings as _gs

                s = _gs()
                api_id = int(s.telethon_api_id) if s.telethon_api_id else None
                api_hash = s.telethon_api_hash
            except Exception:
                api_id, api_hash = None, None
    if not api_id or not api_hash:
        raise ValueError(
            "لم يتم ضبط Telegram API ID و API Hash من إدارة المنصة بعد — تواصل مع الإدارة"
        )
    return TelegramClient(StringSession(), int(api_id), api_hash, device_model="Axogram Notifier")


# --------------------------------------------------------------------------
# Message rendering (variables + spin)
# --------------------------------------------------------------------------

SPIN_RE = re.compile(r"\{spin:([^{}]+)\}")


def render_message(template: str, variables: dict[str, str], spin_variants: dict[str, str] | None = None) -> str:
    """Render {first_name}, {username}... and {spin:opt1|opt2} syntax."""
    if not template:
        return ""
    text = template
    for key, value in variables.items():
        text = text.replace("{" + key + "}", value or "")

    def _spin(match: re.Match) -> str:
        options = [opt.strip() for opt in match.group(1).split("|") if opt.strip()]
        if not options:
            return ""
        if spin_variants is not None:
            key = match.group(1)
            if key not in spin_variants:
                spin_variants[key] = random.choice(options)
            return spin_variants[key]
        return random.choice(options)

    return SPIN_RE.sub(_spin, text)


def make_variables(first_name: str | None = None, username: str | None = None, group_name: str | None = None, group_link: str | None = None, phone: str | None = None) -> dict[str, str]:
    now = datetime.now()
    return {
        "first_name": first_name or "صديقي",
        "last_name": "",
        "username": username or "",
        "phone": phone or "",
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "random_emoji": random.choice(["🔥", "✅", "✨", "🚀", "💎", "🎯"]),
        "group_name": group_name or "",
        "group_link": group_link or "",
    }


# --------------------------------------------------------------------------
# Target resolution
# --------------------------------------------------------------------------

def parse_username(value: str) -> str:
    """Normalize a user identifier: @user, phone, numeric id, t.me link."""
    value = value.strip().strip("'\"")
    if value.startswith("t.me/"):
        value = value.replace("t.me/", "@")
    if value.startswith("https://t.me/"):
        value = value.replace("https://t.me/", "@")
    if value.startswith("http://t.me/"):
        value = value.replace("http://t.me/", "@")
    if value.startswith("@"):
        return value
    if value.replace("+", "").replace(" ", "").isdigit():
        if value.startswith("+"):
            return value
        return "+" + value
    return value


def is_blacklisted(db: Session, user_value: str) -> bool:
    from app.db.models import BlacklistEntry

    normalized = parse_username(user_value).lstrip("@").replace("+", "")
    candidates = [user_value.strip().lstrip("@"), normalized]
    rows = db.query(BlacklistEntry).all()
    for entry in rows:
        entry_val = entry.user_value.strip().lstrip("@").replace("+", "")
        if any(c == entry_val or c.lstrip("+") == entry_val for c in candidates):
            return True
    return False


# --------------------------------------------------------------------------
# Safe send helpers with policy handling
# --------------------------------------------------------------------------

class OpPolicy:
    """Behaviour when errors occur. Values read from campaign/op settings."""

    def __init__(self, *, flood_action: str = "wait", ban_action: str = "remove", privacy_action: str = "skip", slowmode_action: str = "wait", fail_stop_percent: int | None = None):
        self.flood_action = flood_action
        self.ban_action = ban_action
        self.privacy_action = privacy_action
        self.slowmode_action = slowmode_action
        self.fail_stop_percent = fail_stop_percent


def classify_send_error(exc: Exception) -> tuple[str, str]:
    """Return (category, message) for a send error."""
    if isinstance(exc, FloodWaitError):
        return "flood", f"FloodWait {exc.seconds} ثانية"
    if isinstance(exc, SlowModeWaitError):
        return "slowmode", f"Slowmode: انتظر {exc.seconds} ثانية"
    if isinstance(exc, (UserBannedInChannelError, UserKickedError)):
        return "kicked", "طرد/حظر من القناة"
    if isinstance(exc, UserPrivacyRestrictedError):
        return "privacy", "خصوصية المستخدم تمنع الإرسال"
    if isinstance(exc, ChatWriteForbiddenError):
        return "no_write", "لا تملك صلاحية الكتابة في المحادثة"
    if "AUTH_KEY_UNREGISTERED" in str(exc) or "SESSION_REVOKED" in str(exc):
        return "session", "الجلسة غير صالحة (أُلغيت أو انتهت)"
    if "FLOOD" in str(exc).upper():
        return "flood", str(exc)
    return "error", str(exc) or exc.__class__.__name__


def mark_account_blocked(db: Session, account: Account, reason: str = "blocked") -> None:
    account.status = "blocked"
    account.last_used_label = "الآن (محظور)"
    db.add(account)
    db.commit()
    from app.services.audit import write_audit_log

    write_audit_log(db, action="accounts.status.blocked", message=f"تم تحديث حالة {account.phone} إلى محظور: {reason}", entity_type="account", entity_id=str(account.id), level="warn")
