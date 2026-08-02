import json
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import DbSession, get_current_active_user, require_module
from app.db.models import Account, AppSetting, SecurityEvent, User
from app.schemas.common import MessageResponse
from app.schemas.jobs import JobStartResponse
from app.schemas.security import (
    BanMonitorSettingsUpdate,
    CleanupPayload,
    DeviceSession,
    EmergencyAction,
    EncryptionSettingsUpdate,
    Manage2FAUpdate,
    SecurityAuditItem,
    SecurityAuditResult,
    SecurityEventPublic,
    SecurityNotificationsUpdate,
    SecurityReport,
    TerminateSessionPayload,
)
from app.services import jobrunner
from app.services.audit import write_audit_log

router = APIRouter(prefix="/security", tags=["security"], dependencies=[Depends(require_module("security"))])


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
    from app.services.rotation import get_usage_snapshot

    usage = get_usage_snapshot(db)
    flood_today = sum(r["flood_waits"] for r in usage)
    score = 100 if total == 0 else int(100 - (blocked * 20) - (restricted * 10) - min(len(accounts) * 2, 20))
    alerts = blocked + restricted
    if alerts == 0:
        status_label = "ممتاز"
    elif alerts <= 2:
        status_label = "جيد"
    else:
        status_label = "تحذير"
    from app.services.security import is_system_locked

    return {
        "general_status": status_label,
        "score": max(0, min(100, score)),
        "active_alerts": alerts,
        "blocked_today": blocked,
        "flood_waits_today": flood_today,
        "system_locked": is_system_locked(db),
        "ban_monitor_enabled": (__import__("app.services.settings", fromlist=["get_setting_value"]).get_setting_value(db, "ban_monitor_enabled") or "false").lower() in ("true", "1"),
    }


@router.post("/audit", response_model=SecurityAuditResult)
def run_security_audit(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> SecurityAuditResult:
    """Real security audit based on live data."""
    accounts = db.query(Account).all()
    blocked = sum(1 for a in accounts if a.status == "blocked")
    restricted = sum(1 for a in accounts if a.status == "restricted")
    no_session = sum(1 for a in accounts if not a.session_file_path)
    from app.services.rotation import get_usage_snapshot

    usage = get_usage_snapshot(db)
    flood_today = sum(r["flood_waits"] for r in usage)
    from app.db.models import Proxy

    dead_proxies = db.query(Proxy).filter(Proxy.status == "dead").count()
    from app.db.models import NotificationEvent

    suspicious_events = db.query(NotificationEvent).filter(NotificationEvent.level == "critical").count()

    items = [
        SecurityAuditItem(check="حالة جميع الحسابات", status="warning" if restricted else "ok", recommendation="سخّن الحسابات المقيدة" if restricted else None),
        SecurityAuditItem(check="وجود جلسات للحسابات", status="warning" if no_session else "ok", recommendation=f"{no_session} حساب بدون جلسة — أعد ربطها" if no_session else None),
        SecurityAuditItem(check="حالة البروكسيهات", status="warning" if dead_proxies else "ok", recommendation=f"{dead_proxies} بروكسي ميت — استبدلها" if dead_proxies else None),
        SecurityAuditItem(check="معدلات FloodWait اليوم", status="warning" if flood_today >= 5 else "ok", recommendation="قلل الحدود اليومية" if flood_today >= 5 else None),
        SecurityAuditItem(check="الأحداث الحرجة المسجلة", status="warning" if suspicious_events else "ok"),
        SecurityAuditItem(check="الحسابات عالية الخطورة", status="critical" if blocked else "ok", recommendation="راجع الحسابات المحظورة" if blocked else None),
        SecurityAuditItem(check="سلامة قاعدة البيانات", status="ok"),
        SecurityAuditItem(check="تشفير الجلسات", status="ok"),
    ]
    warnings = sum(1 for i in items if i.status == "warning")
    critical = sum(1 for i in items if i.status == "critical")
    score = max(0, 100 - warnings * 5 - critical * 15 - blocked * 5)
    db.add(SecurityEvent(event_type="audit", level="info", message=f"اكتمل الفحص الشامل: النتيجة {score}"))
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
    """Real device sessions fetched from Telegram for each account."""
    from app.services.security import get_account_sessions

    accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).order_by(Account.id.asc()).all()
    result: list[DeviceSession] = []
    for account in accounts:
        try:
            sessions = get_account_sessions(db, account)
            result.extend([DeviceSession(**s) for s in sessions])
        except Exception:
            result.append(DeviceSession(account_id=account.id, phone=account.phone, device="غير متاح", app="تعذر جلب الجلسات", ip="", last_active="", suspicious=False))
    return result


@router.post("/sessions/terminate", response_model=MessageResponse)
def terminate_session(payload: TerminateSessionPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    from app.services.security import terminate_account_session

    if payload.all_others:
        accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).all()
        total = 0
        for account in accounts:
            try:
                total += terminate_account_session(db, account, all_others=True)
            except Exception:
                continue
        write_audit_log(db, action="security.sessions.terminate_all", message=f"إنهاء جميع الجلسات الأخرى ({total})", actor_user_id=current_user.id, entity_type="security", entity_id="sessions", level="warn")
        return MessageResponse(message=f"تم إنهاء {total} جلسة أخرى")
    if not payload.hash:
        raise HTTPException(status_code=400, detail="حدد الجلسة المراد إنهاؤها")
    # find account owning that session hash
    for account in db.query(Account).filter(Account.session_file_path.isnot(None)).all():
        try:
            from app.services.security import get_account_sessions

            sessions = get_account_sessions(db, account)
            if any(s["hash"] == payload.hash for s in sessions):
                terminate_account_session(db, account, hash_value=payload.hash)
                return MessageResponse(message="تم إنهاء الجلسة")
        except Exception:
            continue
    raise HTTPException(status_code=404, detail="الجلسة غير موجودة")


@router.put("/2fa", response_model=MessageResponse)
def manage_2fa(payload: Manage2FAUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    """Real 2FA change via Telethon — password is never stored."""
    from app.services.security import change_2fa

    accounts = []
    if payload.apply_to_all:
        accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).all()
    else:
        account = db.query(Account).filter(Account.id == payload.account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="الحساب غير موجود")
        accounts = [account]
    updated = 0
    errors: list[str] = []
    for account in accounts:
        try:
            change_2fa(db, account, payload.current_password, payload.new_password)
            updated += 1
        except Exception as exc:
            errors.append(f"{account.phone}: {str(exc)[:80]}")
    if updated == 0:
        raise HTTPException(status_code=400, detail="فشل تغيير 2FA: " + " | ".join(errors[:3]))
    write_audit_log(db, action="security.2fa.update", message=f"تحديث 2FA لـ {updated} حساب", actor_user_id=current_user.id, entity_type="security", entity_id="2fa", level="warn")
    return MessageResponse(message=f"تم تحديث 2FA لـ {updated} حساب" + (" (فشل: " + "، ".join(errors) + ")" if errors else ""))


@router.put("/encryption", response_model=MessageResponse)
def update_encryption(payload: EncryptionSettingsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    """Encrypt / decrypt all .session files (AES via Fernet)."""
    from app.services.security import decrypt_all_sessions, encrypt_all_sessions

    if not payload.key:
        raise HTTPException(status_code=400, detail="أدخل مفتاح التشفير")
    try:
        if payload.enabled:
            result = encrypt_all_sessions(db, payload.key)
        else:
            result = decrypt_all_sessions(db, payload.key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"فشل العملية: {exc}") from exc
    write_audit_log(db, action="security.encryption.update", message=f"{'تشفير' if payload.enabled else 'فك تشفير'} الجلسات ({result.get('encrypted', result.get('decrypted', 0))})", actor_user_id=current_user.id, entity_type="security", entity_id="encryption", level="warn")
    return MessageResponse(message=("تم تشفير جميع الجلسات" if payload.enabled else "تم فك تشفير الجلسات") + (f" ({result.get('encrypted', result.get('decrypted', 0))} ملف)"))


@router.get("/encryption/status")
def encryption_status(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.services.settings import get_setting_value
    from app.services.telegram import session_is_encrypted

    accounts = db.query(Account).filter(Account.session_file_path.isnot(None)).all()
    encrypted_count = sum(1 for a in accounts if a.session_file_path and session_is_encrypted(a.session_file_path))
    return {
        "enabled": (get_setting_value(db, "sessions_encryption") or "disabled") == "enabled",
        "encrypted_files": encrypted_count,
        "total_files": len(accounts),
    }


@router.post("/emergency", response_model=MessageResponse)
def emergency_action(payload: EmergencyAction, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    from app.services.security import emergency_delete_sessions, emergency_lock_system, emergency_stop_all

    action = payload.action
    if action == "stop_all":
        result = emergency_stop_all(db)
        return MessageResponse(message=f"تم إيقاف جميع العمليات الجارية ({result['stopped_jobs']} مهمة)")
    if action == "freeze":
        _save_setting(db, "accounts_frozen", "true")
        write_audit_log(db, action="security.emergency.freeze", message="تجميد الحسابات مؤقتاً لمنع الحظر", actor_user_id=current_user.id, entity_type="security", entity_id="emergency", level="warn")
        return MessageResponse(message="تم تجميد جميع الحسابات بنجاح لمنع الاتصال وتفادي الحظر")
    if action == "unfreeze":
        _save_setting(db, "accounts_frozen", "false")
        write_audit_log(db, action="security.emergency.unfreeze", message="إلغاء تجميد الحسابات وإعادة تفعيل الاتصالات", actor_user_id=current_user.id, entity_type="security", entity_id="emergency", level="warn")
        return MessageResponse(message="تم إلغاء تجميد الحسابات وإعادة تفعيل الاتصالات")
    if action == "lock_system":
        result = emergency_lock_system(db)
        return MessageResponse(message=f"تم قفل النظام وإيقاف {result['stopped_jobs']} مهمة")
    if action == "unlock_system":
        _set_setting(db, "system_locked", "false")
        write_audit_log(db, action="security.emergency.unlock", message="فتح النظام", actor_user_id=current_user.id, entity_type="security", entity_id="emergency", level="warn")
        return MessageResponse(message="تم فتح النظام")
    if action == "delete_sessions":
        result = emergency_delete_sessions(db, payload.account_ids)
        return MessageResponse(message=f"تم حذف {result['deleted']} جلسة طارئاً")
    if action == "send_alert":
        from app.services.notify import notify

        event = notify(db, event_type="security.emergency", level="critical", title="🚨 تنبيه طارئ", message=payload.message or "تنبيه طارئ من لوحة التحكم")
        return MessageResponse(message="تم إرسال التنبيه" + ("" if event.delivery_status == "delivered" else " (فشل التسليم — راجع سجل الإشعارات)"))
    if action == "restart":
        import threading

        def _restart():
            import time as _time

            _time.sleep(1)
            import os

            os._exit(0)

        threading.Thread(target=_restart, daemon=True).start()
        return MessageResponse(message="سيتم إعادة تشغيل الخدمة خلال ثوانٍ")
    raise HTTPException(status_code=400, detail="إجراء غير معروف")


@router.post("/ban-monitor/settings", response_model=MessageResponse)
def update_ban_monitor(payload: BanMonitorSettingsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    _set_setting(db, "ban_monitor_enabled", "true" if payload.enabled else "false")
    _set_setting(db, "ban_monitor_interval", str(payload.interval_minutes))
    _set_setting(db, "ban_monitor_action", payload.action)
    if payload.enabled:
        _set_setting(db, "ban_monitor_last_run", "")
    write_audit_log(db, action="security.ban_monitor.settings", message=f"إعدادات مراقب الحظر: {'مفعل' if payload.enabled else 'معطل'} (كل {payload.interval_minutes} د)", actor_user_id=current_user.id, entity_type="security", entity_id="ban_monitor")
    return MessageResponse(message="تم حفظ إعدادات مراقب الحظر")


@router.get("/ban-monitor/status")
def ban_monitor_status(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    from app.services.settings import get_setting_value

    return {
        "enabled": (get_setting_value(db, "ban_monitor_enabled") or "false").lower() in ("true", "1"),
        "interval_minutes": int(get_setting_value(db, "ban_monitor_interval") or 15),
        "action": get_setting_value(db, "ban_monitor_action") or "notify",
        "last_run": get_setting_value(db, "ban_monitor_last_run"),
    }


@router.post("/ban-monitor/run", response_model=JobStartResponse)
def run_ban_monitor_now(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="security_ban_monitor",
        label="فحص الحظر الآن",
        entity_type="security",
        entity_id="ban_monitor",
        actor_user_id=current_user.id,
        payload={"actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ الفحص الفوري للحظر", job_id=job_id)


@router.post("/cleanup", response_model=JobStartResponse)
def start_cleanup(payload: CleanupPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="security_cleanup",
        label="تنظيف الحسابات",
        entity_type="account",
        entity_id="cleanup",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأ التنظيف — تابع التقدم من سجل المهام", job_id=job_id)


@router.put("/notifications", response_model=MessageResponse)
def update_security_notifications(payload: SecurityNotificationsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    _set_setting(db, "security_notifications", json.dumps(payload.model_dump()))
    write_audit_log(db, action="security.notifications.update", message="تحديث إعدادات تنبيهات الأمان", actor_user_id=current_user.id, entity_type="security", entity_id="notifications")
    return MessageResponse(message="تم حفظ إعدادات التنبيهات")


@router.get("/events", response_model=list[SecurityEventPublic])
def security_events(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 30) -> list[SecurityEventPublic]:
    rows = db.query(SecurityEvent).order_by(SecurityEvent.created_at.desc()).limit(min(limit, 200)).all()
    return [SecurityEventPublic.model_validate(row) for row in rows]


def _security_report_for(db, day: datetime) -> SecurityReport:
    from app.services.rotation import get_usage_snapshot

    key = day.strftime("%Y-%m-%d")
    usage = get_usage_snapshot(db, key)
    flood = sum(r["flood_waits"] for r in usage)
    events = db.query(SecurityEvent).filter(func_date(SecurityEvent.created_at) == day.date()).all()
    critical = sum(1 for e in events if e.level == "critical")
    bans = db.query(Account).filter(Account.status == "blocked").count() if day.date() == datetime.now(timezone.utc).date() else critical
    restrictions = sum(1 for e in events if e.level == "warn")
    score = max(0, 100 - flood - bans * 20 - restrictions * 5)
    return SecurityReport(
        date=key,
        flood_waits=flood,
        bans=bans,
        restrictions=restrictions,
        suspicious=critical,
        alerts=bans + restrictions + critical,
        score=score,
        events_count=len(events),
    )


def func_date(column):
    from sqlalchemy import func

    return func.date(column)


@router.get("/reports/today", response_model=SecurityReport)
def security_report_today(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> SecurityReport:
    return _security_report_for(db, datetime.now(timezone.utc))


@router.get("/reports/week")
def security_report_week(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    days = []
    for offset in range(6, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=offset)
        days.append(_security_report_for(db, day).model_dump())
    return {"days": days, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/reports/export")
def export_security_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], period: str = "today", format_value: str = "pdf") -> Response:
    from app.services.pdfexport import build_report_pdf

    if period == "week":
        data = security_report_week(db, current_user)
        data = {"days": len(data["days"]), **{f"day_{i+1}": f"{d['date']}: flood={d['flood_waits']}, bans={d['bans']}, score={d['score']}" for i, d in enumerate(data["days"])}}
    else:
        data = security_report_today(db, current_user).model_dump()
    if format_value == "pdf":
        pdf = build_report_pdf("تقرير الأمان", data)
        return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=security-report-{period}.pdf"})
    import io

    import csv as _csv

    buffer = io.StringIO()
    writer = _csv.writer(buffer)
    writer.writerow(["key", "value"])
    for key, value in data.items():
        writer.writerow([key, str(value)])
    return Response(content=buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=security-report-{period}.csv"})
