"""Notification service: events are stored and delivered to a Telegram target
(an account session or a bot token) by the scheduler loop / worker."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Account, NotificationEvent
from app.services.audit import write_audit_log
from app.services.settings import get_setting_value


def _settings_dict(db: Session) -> dict:
    raw = get_setting_value(db, "notify_settings")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def emit_event(
    db: Session,
    *,
    event_type: str,
    level: str = "info",
    title: str = "",
    message: str = "",
    details: dict | None = None,
    commit: bool = True,
) -> NotificationEvent:
    event = NotificationEvent(
        event_type=event_type,
        level=level,
        title=title or event_type,
        message=message,
        details_json=json.dumps(details or {}, ensure_ascii=False),
        delivery_status="pending",
    )
    db.add(event)
    if commit:
        db.commit()
        db.refresh(event)
    return event


def notify(db: Session, *, event_type: str, level: str = "info", title: str = "", message: str = "") -> NotificationEvent:
    """Emit + attempt immediate delivery when a notifier account is configured."""
    event = emit_event(db, event_type=event_type, level=level, title=title, message=message)
    cfg = _settings_dict(db)
    if not cfg.get("enabled", True):
        event.delivery_status = "skipped"
        db.add(event)
        db.commit()
        return event
    try:
        deliver_event(db, event.id)
    except Exception as exc:
        event.delivery_status = "failed"
        event.delivery_error = str(exc)
        db.add(event)
        db.commit()
    return event


def deliver_event(db: Session, event_id: int) -> bool:
    """Deliver a pending event to the configured Telegram target. Raises on failure."""
    event = db.query(NotificationEvent).filter(NotificationEvent.id == event_id).first()
    if not event:
        return False
    cfg = _settings_dict(db)
    target = (cfg.get("target") or "").strip()
    account_phone = (cfg.get("account_phone") or "").strip()
    bot_token = (cfg.get("bot_token") or "").strip()
    if not target:
        event.delivery_status = "skipped"
        event.delivery_error = "لا يوجد هدف إشعارات مضبوط"
        db.add(event)
        db.commit()
        return False

    from app.services.telegram import build_bot_client, build_client_for_account, parse_username

    text = f"🔔 {event.title}\n\n{event.message}"
    try:
        if bot_token:
            api_id, api_hash = _api_credentials(db)
            client = build_bot_client(bot_token, api_id, api_hash)
            asyncio_run_connect(client, lambda: client.send_message(parse_username(target), text))
        else:
            if not account_phone:
                raise ValueError("لا يوجد حساب إشعارات (bot_token أو account_phone)")
            account = db.query(Account).filter(Account.phone == account_phone).first()
            if not account or not account.session_file_path:
                raise ValueError("حساب الإشعارات غير مرتبط بجلسة تيليجرام")
            client = build_client_for_account(db, account)
            asyncio_run_connect(client, lambda: client.send_message(parse_username(target), text))
        event.delivery_status = "delivered"
        event.delivery_error = None
        event.sent_at = datetime.now(timezone.utc)
        db.add(event)
        db.commit()
        return True
    except Exception as exc:
        event.delivery_status = "failed"
        event.delivery_error = str(exc)
        db.add(event)
        db.commit()
        raise


def _api_credentials(db: Session) -> tuple[int, str]:
    try:
        return get_telegram_credentials_public(db)
    except Exception:
        return 0, ""


def get_telegram_credentials_public(db: Session) -> tuple[int, str]:
    from app.services.settings import get_telegram_credentials

    return get_telegram_credentials(db)


def asyncio_run_connect(client, fn):
    import asyncio

    async def _run():
        await client.connect()
        try:
            return await fn()
        finally:
            await client.disconnect()

    return asyncio.run(_run())


def deliver_pending(db: Session, limit: int = 20) -> int:
    events = db.query(NotificationEvent).filter(NotificationEvent.delivery_status == "pending").order_by(NotificationEvent.id.asc()).limit(limit).all()
    delivered = 0
    for event in events:
        try:
            if deliver_event(db, event.id):
                delivered += 1
        except Exception:
            continue
    return delivered


def send_test(db: Session, target: str | None = None) -> dict:
    cfg = _settings_dict(db)
    resolved_target = target or cfg.get("target")
    if not resolved_target:
        raise ValueError("حدد هدف الإشعارات أولاً (Telegram ID أو @username)")
    from app.services.telegram import parse_username

    event = emit_event(db, event_type="test", level="info", title="✅ اختبار الإشعارات", message=f"تم إرسال إشعار تجريبي إلى {resolved_target} بنجاح")
    try:
        deliver_event(db, event.id)
        return {"message": f"تم إرسال إشعار تجريبي إلى {parse_username(resolved_target)}", "event_id": event.id, "delivery_status": "delivered"}
    except Exception as exc:
        return {"message": f"فشل الإرسال: {exc}", "event_id": event.id, "delivery_status": "failed"}
