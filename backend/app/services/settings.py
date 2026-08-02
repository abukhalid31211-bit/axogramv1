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
        raise ValueError("يجب من مالك الموقع (الإدارة) ضبط Telegram API ID و API Hash من لوحة الإدارة أولاً")
    try:
        api_id_int = int(str(api_id_raw).strip())
    except ValueError as exc:
        raise ValueError("معرف Telegram API ID يجب أن يكون رقماً صحيحاً") from exc
    return api_id_int, str(api_hash).strip()
