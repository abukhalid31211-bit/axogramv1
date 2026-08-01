from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DbSession, require_module
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import AppSetting, User
from app.schemas.common import MessageResponse
from app.schemas.setting import SettingBatchUpdate, SettingPublic
from app.services.audit import write_audit_log
from app.services.subscription import is_platform_admin

router = APIRouter(prefix="/settings", tags=["settings"])

# Keys reserved for the platform admin — invisible and read-only to subscribers.
RESERVED_KEYS = {
    "telegram_api_id",
    "telegram_api_hash",
    "clients_locked",
    "broadcast_message",
    "admin_purge_last_run",
}


@router.get("", response_model=list[SettingPublic])
def list_settings(db: DbSession, current_user: Annotated[User, Depends(require_module("settings"))]) -> list[SettingPublic]:
    rows = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    out: list[SettingPublic] = []
    for row in rows:
        if row.key in RESERVED_KEYS and not is_platform_admin(current_user):
            continue  # platform-level credentials are never shown to subscribers
        out.append(
            SettingPublic(
                key=row.key,
                value=decrypt_value(row.value_encrypted),
                is_secret=row.is_secret,
                description=row.description,
                updated_at=row.updated_at,
            )
        )
    return out


@router.put("", response_model=MessageResponse)
def upsert_settings(
    payload: SettingBatchUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_module("settings"))],
) -> MessageResponse:
    for item in payload.items:
        if item.key in RESERVED_KEYS and not is_platform_admin(current_user):
            raise HTTPException(
                status_code=403,
                detail=f"الإعداد {item.key} يخص إدارة النظام فقط — تواصل مع الإدارة",
            )
        existing = db.query(AppSetting).filter(AppSetting.key == item.key).first()
        if existing:
            existing.value_encrypted = encrypt_value(item.value)
            existing.is_secret = item.is_secret
            existing.description = item.description
            db.add(existing)
        else:
            db.add(
                AppSetting(
                    key=item.key,
                    value_encrypted=encrypt_value(item.value),
                    is_secret=item.is_secret,
                    description=item.description,
                )
            )
    db.commit()
    write_audit_log(db, action="settings.update", message="Updated application settings", actor_user_id=current_user.id, entity_type="settings", entity_id="global")
    return MessageResponse(message="تم حفظ الإعدادات")
