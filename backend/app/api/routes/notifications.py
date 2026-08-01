import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DbSession, get_current_active_user
from app.core.crypto import encrypt_value
from app.db.models import AppSetting, NotificationEvent, User
from app.schemas.notification import NotificationEventPublic, NotificationSettingsUpdate, NotificationTestPayload
from app.services.audit import write_audit_log

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _set_setting(db, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False))
    db.commit()


@router.get("/settings")
def get_notification_settings(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.services.settings import get_setting_value

    raw = get_setting_value(db, "notify_settings")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return {
        "enabled": True,
        "target": "",
        "account_phone": "",
        "bot_token": "",
        "on_campaign_done": True,
        "on_account_blocked": True,
        "on_proxy_dead": True,
        "on_errors": True,
        "daily_report": True,
    }


@router.put("/settings")
def update_notification_settings(payload: NotificationSettingsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    _set_setting(db, "notify_settings", json.dumps(payload.model_dump(exclude_none=True), ensure_ascii=False))
    write_audit_log(db, action="notifications.settings.update", message="تحديث إعدادات الإشعارات", actor_user_id=current_user.id, entity_type="notifications", entity_id="settings")
    return {"message": "تم حفظ إعدادات الإشعارات"}


@router.get("/events", response_model=list[NotificationEventPublic])
def list_events(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 50) -> list[NotificationEventPublic]:
    rows = db.query(NotificationEvent).order_by(NotificationEvent.created_at.desc()).limit(min(limit, 200)).all()
    return [NotificationEventPublic.model_validate(row) for row in rows]


@router.post("/test")
def send_test_notification(payload: NotificationTestPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.services.notify import send_test

    try:
        return send_test(db, payload.target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"فشل إرسال الإشعار التجريبي: {exc}") from exc


@router.post("/events/{event_id}/retry")
def retry_event(event_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.services.notify import deliver_event

    event = db.query(NotificationEvent).filter(NotificationEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="الحدث غير موجود")
    try:
        deliver_event(db, event_id)
        return {"message": "تم إعادة إرسال الإشعار بنجاح"}
    except Exception as exc:
        return {"message": f"فشلت إعادة الإرسال: {exc}"}
