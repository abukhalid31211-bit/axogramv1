"""Application settings helpers.

Telegram API credentials (API ID / API Hash) belong to the *platform owner*, not
to the subscriber: they are configured once from the admin panel (or via
environment variables) and are then applied automatically everywhere in the
system — OTP login, gathering, adding, campaigns, security tools, schedulers...
Subscribers never see them and never have to type them, even when the whole
"settings" module is hidden from their plan.
"""
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import AppSetting

TELEGRAM_API_ID_KEY = "telegram_api_id"
TELEGRAM_API_HASH_KEY = "telegram_api_hash"

# Values shipped by the old seed data — they are not real credentials, so they
# must be treated exactly like "not configured yet".
PLACEHOLDER_API_ID = "12345678"
PLACEHOLDER_API_HASH = "a1b2c3d4e5f6"

# Single Arabic message shown to subscribers everywhere credentials are missing.
TELEGRAM_CREDENTIALS_MISSING_MESSAGE = (
    "لم يتم ضبط Telegram API ID و API Hash من إدارة المنصة بعد — تواصل مع الإدارة "
    "(لا حاجة لإدخال أي بيانات API من جهتك)"
)


def get_setting_value(db: Session, key: str) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return None
    try:
        return decrypt_value(row.value_encrypted)
    except Exception:
        return None


def set_setting_value(
    db: Session,
    key: str,
    value: str,
    *,
    is_secret: bool = False,
    description: str | None = None,
    commit: bool = True,
) -> None:
    """Create/update an encrypted application setting."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        row.is_secret = is_secret
        if description is not None:
            row.description = description
        db.add(row)
    else:
        db.add(
            AppSetting(
                key=key,
                value_encrypted=encrypt_value(value),
                is_secret=is_secret,
                description=description,
            )
        )
    if commit:
        db.commit()


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _is_placeholder(api_id: str, api_hash: str) -> bool:
    """The legacy demo credentials can never work against Telegram."""
    return api_id == PLACEHOLDER_API_ID and api_hash == PLACEHOLDER_API_HASH


def _valid_pair(api_id: str, api_hash: str) -> bool:
    if not api_id or not api_hash:
        return False
    if _is_placeholder(api_id, api_hash):
        return False
    if not api_id.isdigit() or int(api_id) <= 0:
        return False
    return True


def resolve_telegram_credentials(db: Session) -> tuple[int | None, str | None, str]:
    """Return ``(api_id, api_hash, source)`` for the whole platform.

    ``source`` is ``database`` (set by the owner from the admin panel),
    ``environment`` (TELETHON_API_ID / TELETHON_API_HASH) or ``none``.
    Database values always win so the admin panel stays the source of truth.
    """
    api_id = _clean(get_setting_value(db, TELEGRAM_API_ID_KEY))
    api_hash = _clean(get_setting_value(db, TELEGRAM_API_HASH_KEY))
    if _valid_pair(api_id, api_hash):
        return int(api_id), api_hash, "database"

    settings = get_settings()
    env_id = _clean(settings.telethon_api_id)
    env_hash = _clean(settings.telethon_api_hash)
    if _valid_pair(env_id, env_hash):
        return int(env_id), env_hash, "environment"

    return None, None, "none"


def telegram_credentials_configured(db: Session) -> bool:
    api_id, api_hash, _ = resolve_telegram_credentials(db)
    return bool(api_id and api_hash)


def get_telegram_credentials(db: Session) -> tuple[int, str]:
    """Platform-wide Telegram credentials used by every engine/task.

    Raises ``ValueError`` (with a subscriber-friendly Arabic message) when the
    platform owner has not configured them yet.
    """
    api_id, api_hash, _ = resolve_telegram_credentials(db)
    if not api_id or not api_hash:
        raise ValueError(TELEGRAM_CREDENTIALS_MISSING_MESSAGE)
    return api_id, api_hash
