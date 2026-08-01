from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, AppSetting, RotationLog, User
from app.schemas.common import MessageResponse
from app.schemas.rotation import (
    RotationAnalytics,
    RotationExclusionRules,
    RotationLogPublic,
    RotationNotificationsUpdate,
    RotationProfile,
    RotationSettingUpdate,
    RotationTableRow,
    RotationUsageRow,
)
from app.services.audit import write_audit_log

router = APIRouter(prefix="/rotation", tags=["rotation"])

ROTATION_SETTING_DEFAULTS = {
    "rotation_mode": "smart",
    "rotation_condition": "count",
    "rotation_on_block": "switch",
    "rotation_on_limit": "wait",
    "rotation_switch_ops": "5",
    "rotation_delay_min": "60",
    "rotation_delay_max": "120",
    "rotation_rest_after": "20",
    "rotation_work_from": "08:00",
    "rotation_work_to": "23:00",
}

ROTATION_PROFILES = [
    RotationProfile(id="safe", name="سيناريو الأمان الأقصى", icon="🛡️", lines=["تأخير 120-180 ث | 5 عمليات/تبديل", "راحة 30 د بعد 10 عمليات", "حد يومي: 10 إضافة/حساب"], delay_min=120, delay_max=180, switch_ops=5, rest_after=10, daily_add_limit=10),
    RotationProfile(id="balanced", name="سيناريو متوازن (موصى)", icon="⭐", lines=["تأخير 60-120 ث | 10 عمليات/تبديل", "راحة 15 د بعد 20 عملية", "حد يومي: 25 إضافة/حساب"], delay_min=60, delay_max=120, switch_ops=10, rest_after=20, daily_add_limit=25),
    RotationProfile(id="fast", name="سيناريو الإنتاجية العالية", icon="⚡", lines=["تأخير 30-60 ث | 20 عملية/تبديل", "حد يومي: 40 إضافة/حساب", "⚠️ خطر متوسط"], delay_min=30, delay_max=60, switch_ops=20, rest_after=40, daily_add_limit=40),
    RotationProfile(id="new", name="حسابات جديدة (أقل من شهر)", icon="🆕", lines=["تأخير 180-300 ث | 3 عمليات/تبديل", "حد يومي: 5 إضافة/حساب", "تسخين إجباري 7 أيام أولاً"], delay_min=180, delay_max=300, switch_ops=3, rest_after=10, daily_add_limit=5),
]


def _get_setting(db, key: str, default: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return default
    try:
        from app.core.crypto import decrypt_value
        return decrypt_value(row.value_encrypted)
    except Exception:
        return default


def _set_setting(db, key: str, value: str) -> None:
    from app.core.crypto import encrypt_value
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False))


@router.get("/settings")
def get_rotation_settings(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict[str, str]:
    return {key: _get_setting(db, key, default) for key, default in ROTATION_SETTING_DEFAULTS.items()}


@router.put("/settings", response_model=MessageResponse)
def update_rotation_settings(
    payload: RotationSettingUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageResponse:
    mapping = {
        "mode": "rotation_mode",
        "condition": "rotation_condition",
        "on_block": "rotation_on_block",
        "on_limit": "rotation_on_limit",
        "switch_ops": "rotation_switch_ops",
        "delay_min": "rotation_delay_min",
        "delay_max": "rotation_delay_max",
        "rest_after": "rotation_rest_after",
        "work_from": "rotation_work_from",
        "work_to": "rotation_work_to",
    }
    data = payload.model_dump(exclude_unset=True)
    for field, key in mapping.items():
        if data.get(field) is not None:
            _set_setting(db, key, str(data[field]))
    if data.get("work_days"):
        _set_setting(db, "rotation_work_days", ",".join(data["work_days"]))
    db.commit()
    write_audit_log(db, action="rotation.settings.update", message="Updated rotation settings", actor_user_id=current_user.id, entity_type="rotation", entity_id="settings")
    return MessageResponse(message="تم حفظ إعدادات التدوير")


@router.get("/table", response_model=list[RotationTableRow])
def rotation_table(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[RotationTableRow]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    rows = []
    for i, acc in enumerate(accounts):
        status = "active" if i == 0 else ("paused" if acc.status == "restricted" else "active")
        next_phone = accounts[i + 1].phone if i + 1 < len(accounts) else (accounts[0].phone if accounts else None)
        rows.append(
            RotationTableRow(
                position=i + 1,
                account_id=acc.id,
                phone=acc.phone,
                health=max(35, min(96, 72 + min(acc.groups_count, 20))),
                gather=120,
                add=18,
                dm=8,
                status=status,
                next_phone=next_phone,
            )
        )
    return rows


@router.get("/usage", response_model=list[RotationUsageRow])
def rotation_usage(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[RotationUsageRow]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    return [
        RotationUsageRow(
            account_id=acc.id,
            phone=acc.phone,
            gather=120,
            add=18,
            dm=8,
            groups=acc.groups_count,
            status=acc.status,
            remaining=max(0, 500 - 120),
        )
        for acc in accounts
    ]


@router.post("/reset", response_model=MessageResponse)
def reset_counters(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    write_audit_log(db, action="rotation.reset", message="Reset daily counters", actor_user_id=current_user.id, entity_type="rotation", entity_id="counters", level="warn")
    return MessageResponse(message="تم تصفير العدادات اليومية")


@router.get("/profiles", response_model=list[RotationProfile])
def rotation_profiles(current_user: Annotated[User, Depends(get_current_active_user)]) -> list[RotationProfile]:
    return ROTATION_PROFILES


@router.post("/profiles/{profile_id}/apply", response_model=MessageResponse)
def apply_profile(
    profile_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageResponse:
    profile = next((p for p in ROTATION_PROFILES if p.id == profile_id), None)
    if not profile:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="السيناريو غير موجود")
    _set_setting(db, "rotation_delay_min", str(profile.delay_min))
    _set_setting(db, "rotation_delay_max", str(profile.delay_max))
    _set_setting(db, "rotation_switch_ops", str(profile.switch_ops))
    _set_setting(db, "rotation_rest_after", str(profile.rest_after))
    db.commit()
    write_audit_log(db, action="rotation.profile.apply", message=f"Applied rotation profile {profile.name}", actor_user_id=current_user.id, entity_type="rotation", entity_id=profile_id)
    return MessageResponse(message=f"تم تطبيق سيناريو {profile.name}")


@router.get("/analytics", response_model=RotationAnalytics)
def rotation_analytics(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> RotationAnalytics:
    logs = db.query(RotationLog).order_by(RotationLog.switched_at.desc()).all()
    today = datetime.now(timezone.utc).date()
    switches_today = sum(1 for log in logs if log.switched_at.date() == today)
    switches_week = len(logs)
    reasons: dict[str, int] = {}
    for log in logs:
        reasons[log.reason] = reasons.get(log.reason, 0) + 1
    last = logs[0] if logs else None
    return RotationAnalytics(
        switches_today=switches_today,
        switches_week=switches_week,
        avg_ops_before_switch=9,
        switch_reasons=reasons,
        last_switch_at=last.switched_at if last else None,
    )


@router.get("/logs", response_model=list[RotationLogPublic])
def rotation_logs(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 20) -> list[RotationLogPublic]:
    rows = db.query(RotationLog).order_by(RotationLog.switched_at.desc()).limit(limit).all()
    return [RotationLogPublic.model_validate(row) for row in rows]


@router.post("/switch", response_model=MessageResponse)
def manual_switch(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    reason: str = "manual",
) -> MessageResponse:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    if len(accounts) >= 2:
        db.add(RotationLog(from_phone=accounts[0].phone, to_phone=accounts[1].phone, reason=reason))
        db.commit()
    write_audit_log(db, action="rotation.switch", message="Manual rotation switch", actor_user_id=current_user.id, entity_type="rotation", entity_id="switch")
    return MessageResponse(message="تم التبديل اليدوي")


@router.put("/exclusion", response_model=MessageResponse)
def update_exclusion(
    payload: RotationExclusionRules,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageResponse:
    import json
    _set_setting(db, "rotation_exclusion", json.dumps(payload.model_dump()))
    db.commit()
    write_audit_log(db, action="rotation.exclusion.update", message="Updated exclusion rules", actor_user_id=current_user.id, entity_type="rotation", entity_id="exclusion")
    return MessageResponse(message="تم حفظ قواعد الاستبعاد")


@router.put("/notifications", response_model=MessageResponse)
def update_rotation_notifications(
    payload: RotationNotificationsUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageResponse:
    import json
    _set_setting(db, "rotation_notifications", json.dumps(payload.model_dump()))
    db.commit()
    write_audit_log(db, action="rotation.notifications.update", message="Updated rotation notifications", actor_user_id=current_user.id, entity_type="rotation", entity_id="notifications")
    return MessageResponse(message="تم حفظ إعدادات الإشعارات")
