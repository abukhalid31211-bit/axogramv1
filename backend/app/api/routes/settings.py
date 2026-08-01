from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_admin
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import AppSetting, User
from app.schemas.common import MessageResponse
from app.schemas.setting import SettingBatchUpdate, SettingPublic
from app.services.audit import write_audit_log

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[SettingPublic])
def list_settings(db: DbSession, current_user: Annotated[User, Depends(require_admin)]) -> list[SettingPublic]:
    rows = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    return [
        SettingPublic(
            key=row.key,
            value=decrypt_value(row.value_encrypted),
            is_secret=row.is_secret,
            description=row.description,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.put("", response_model=MessageResponse)
def upsert_settings(
    payload: SettingBatchUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_admin)],
) -> MessageResponse:
    for item in payload.items:
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
