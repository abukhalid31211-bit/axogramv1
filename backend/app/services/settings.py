from sqlalchemy.orm import Session

from app.core.crypto import decrypt_value
from app.db.models import AppSetting


def get_setting_value(db: Session, key: str) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return None
    try:
        return decrypt_value(row.value_encrypted)
    except Exception:
        return None


def get_telegram_credentials(db: Session) -> tuple[int, str]:
    api_id_raw = get_setting_value(db, "telegram_api_id")
    api_hash = get_setting_value(db, "telegram_api_hash")
    if not api_id_raw or not api_hash:
        raise ValueError("Telegram API credentials are not configured")
    return int(api_id_raw), api_hash
