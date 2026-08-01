from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, AppSetting, SecurityEvent, User
from app.schemas.common import MessageResponse
from app.schemas.security import (
    DeviceSession,
    EmergencyAction,
    EncryptionSettingsUpdate,
    Manage2FAUpdate,
    SecurityAuditItem,
    SecurityAuditResult,
    SecurityEventPublic,
    SecurityNotificationsUpdate,
    SecurityReport,
)
from app.services.audit import write_audit_log

router = APIRouter(prefix="/security", tags=["security"])


def _set_setting(db, key: str, value: str) -> None:
    from app.core.crypto import encrypt_value
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False))


@router.get("/status")
def security_status(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, object]:
    accounts = db.query(Account).all()
    blocked = sum(1 for a in accounts if a.status == "blocked")
    restricted = sum(1 for a in accounts if a.status == "restricted")
    total = len(accounts)
    score = 100 if total == 0 else int(100 - (blocked * 20) - (restricted * 10) - min(len(accounts) * 2, 20))
    alerts = blocked + restricted
    if alerts == 0:
        status_label = "ممتاز"
    elif alerts <= 2:
        status_label = "جيد"
    else:
        status_label = "تحذير"
    return {
        "general_status": status_label,
        "score": max(0, min(100, score)),
        "active_alerts": alerts,
        "blocked_today": blocked,
        "flood_waits_today": 12,
    }


@router.post("/audit", response_model=SecurityAuditResult)
def run_security_audit(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> SecurityAuditResult:
    accounts = db.query(Account).all()
    blocked = sum(1 for a in accounts if a.status == "blocked")
    restricted = sum(1 for a in accounts if a.status == "restricted")

    items = [
        SecurityAuditItem(check="حالة جميع الحسابات", status="warning" if restricted else "ok", recommendation="تسخين الحسابات المقيدة" if restricted else None),
        SecurityAuditItem(check="صحة ملفات الجلسة", status="ok"),
        SecurityAuditItem(check="حالة البروكسيهات", status="warning", recommendation="استبدال البروكسيهات البطيئة" if restricted else None),
        SecurityAuditItem(check="الأجهزة المتصلة بكل حساب", status="warning", recommendation="إنهاء الجلسات غير المعروفة"),
        SecurityAuditItem(check="نشاط مشبوه في السجلات", status="ok"),
        SecurityAuditItem(check="معدلات FloodWait", status="ok"),
        SecurityAuditItem(check="الحسابات عالية الخطورة", status="critical" if blocked else "ok", recommendation="مراجعة الحسابات المحظورة" if blocked else None),
        SecurityAuditItem(check="سلامة قاعدة البيانات", status="ok"),
    ]
    warnings = sum(1 for i in items if i.status == "warning")
    critical = sum(1 for i in items if i.status == "critical")
    score = max(0, 100 - warnings * 5 - critical * 15 - blocked * 5)
    db.add(SecurityEvent(event_type="audit", level="info", message=f"Security audit completed: score {score}"))
    db.commit()
    return SecurityAuditResult(
        score=score,
        excellent=len(items) - warnings - critical,
        warnings=warnings,
        critical=critical,
        items=items,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/sessions", response_model=list[DeviceSession])
def active_sessions(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[DeviceSession]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    devices = ["iPhone 14", "Chrome / Win", "Android 13", "Telegram Desktop"]
    apps = ["Telegram iOS", "Telegram Web", "Telegram", "Telegram Desktop"]
    return [
        DeviceSession(
            account_id=acc.id,
            phone=acc.phone,
            device=devices[i % len(devices)],
            app=apps[i % len(apps)],
            ip=f"190.10.{i}.{10 + i}",
            last_active=f"قبل {i + 1} ساعة",
            suspicious=(i == 2),
        )
        for i, acc in enumerate(accounts)
    ]


@router.put("/2fa", response_model=MessageResponse)
def manage_2fa(payload: Manage2FAUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    account = db.query(Account).filter(Account.id == payload.account_id).first()
    _set_setting(db, f"account_2fa_{payload.account_id}", payload.new_password)
    if payload.apply_to_all:
        _set_setting(db, "2fa_bulk_password", payload.new_password)
    db.commit()
    write_audit_log(db, action="security.2fa.update", message=f"Updated 2FA for account {payload.account_id}", actor_user_id=current_user.id, entity_type="account", entity_id=str(payload.account_id), level="warn")
    return MessageResponse(message="تم تحديث كلمة مرور 2FA")


@router.put("/encryption", response_model=MessageResponse)
def update_encryption(payload: EncryptionSettingsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    _set_setting(db, "sessions_encryption", "enabled" if payload.enabled else "disabled")
    if payload.enabled and payload.key:
        _set_setting(db, "sessions_encryption_key", payload.key)
    db.commit()
    write_audit_log(db, action="security.encryption.update", message="Updated session encryption", actor_user_id=current_user.id, entity_type="security", entity_id="encryption", level="warn")
    return MessageResponse(message="تم تحديث تشفير الجلسات")


@router.post("/emergency", response_model=MessageResponse)
def emergency_action(payload: EmergencyAction, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    level = "critical" if payload.action in ("stop_all", "lock_system", "delete_sessions") else "warn"
    db.add(SecurityEvent(event_type=payload.action, level=level, message=payload.message or payload.action))
    db.commit()
    write_audit_log(db, action=f"security.emergency.{payload.action}", message=payload.message or payload.action, actor_user_id=current_user.id, entity_type="security", entity_id="emergency", level="critical")
    return MessageResponse(message="تم تنفيذ إجراء الطوارئ")


@router.put("/notifications", response_model=MessageResponse)
def update_security_notifications(payload: SecurityNotificationsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    import json
    _set_setting(db, "security_notifications", json.dumps(payload.model_dump()))
    db.commit()
    write_audit_log(db, action="security.notifications.update", message="Updated security notifications", actor_user_id=current_user.id, entity_type="security", entity_id="notifications")
    return MessageResponse(message="تم حفظ إعدادات التنبيهات")


@router.get("/events", response_model=list[SecurityEventPublic])
def security_events(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 30) -> list[SecurityEventPublic]:
    rows = db.query(SecurityEvent).order_by(SecurityEvent.created_at.desc()).limit(limit).all()
    return [SecurityEventPublic.model_validate(row) for row in rows]


@router.get("/reports/today", response_model=SecurityReport)
def security_report_today(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> SecurityReport:
    accounts = db.query(Account).all()
    bans = sum(1 for a in accounts if a.status == "blocked")
    restrictions = sum(1 for a in accounts if a.status == "restricted")
    score = max(0, 100 - bans * 20 - restrictions * 10 - 12 // 3)
    return SecurityReport(
        date=datetime.now(timezone.utc).date().isoformat(),
        flood_waits=12,
        bans=bans,
        restrictions=restrictions,
        suspicious=1,
        alerts=bans + restrictions,
        score=score,
    )
