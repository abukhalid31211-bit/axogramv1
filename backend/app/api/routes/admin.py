"""Platform-admin panel API: subscribers, plans, usage, broadcast, logs, locks.

Every endpoint here requires the permanent platform admin (matched by e-mail).
"""
from __future__ import annotations

import io
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import DbSession, PlatformAdmin
from app.core.crypto import encrypt_value
from app.core.security import get_password_hash
from app.db.models import Account, ActivityLog, AppSetting, JobRun, NotificationEvent, Plan, User
from app.schemas.admin import (
    AdminLogEntry,
    AdminStats,
    BroadcastPayload,
    DeleteSubscriberPayload,
    ExtendPayload,
    ModuleInfo,
    ModulesUpdate,
    PlanCreate,
    PlanPublic,
    PlanUpdate,
    QuotasUpdate,
    ResetPasswordResponse,
    SubscriberCreate,
    SubscriberDetail,
    SubscriberPublic,
    TelegramCredentialsPublic,
    TelegramCredentialsResponse,
    TelegramCredentialsUpdate,
    UsageRow,
)
from app.schemas.common import MessageResponse
from app.services.audit import write_audit_log
from app.services.subscription import (
    ALL_MODULES,
    DEFAULT_QUOTAS,
    MODULE_LABELS,
    active_jobs_count,
    is_platform_admin,
    owned_accounts_count,
    remaining_label,
    remaining_seconds,
    subscription_status,
    user_daily_usage,
    user_modules,
    user_quotas,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_quotas(raw: dict[str, int] | None) -> dict[str, int]:
    quotas: dict[str, int] = {}
    for key, value in (raw or {}).items():
        if key not in DEFAULT_QUOTAS:
            continue
        try:
            quotas[key] = max(0, int(value))
        except Exception:
            continue
    return quotas


def _clean_modules(raw: list[str] | None) -> list[str]:
    seen: list[str] = []
    for item in raw or []:
        if item in ALL_MODULES and item not in seen:
            seen.append(item)
    return seen


def _get_subscriber(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or is_platform_admin(user) or user.role == "admin":
        raise HTTPException(status_code=404, detail="المشترك غير موجود")
    return user


def _last_login(db: Session, user_id: int) -> datetime | None:
    row = (
        db.query(ActivityLog)
        .filter(ActivityLog.actor_user_id == user_id, ActivityLog.action == "auth.login")
        .order_by(ActivityLog.created_at.desc())
        .first()
    )
    return row.created_at if row else None


def _subscriber_public(db: Session, user: User) -> SubscriberPublic:
    return SubscriberPublic(
        id=user.id,
        email=user.email or user.username,
        status=subscription_status(user),
        remaining_seconds=remaining_seconds(user),
        remaining_label=remaining_label(user),
        expires_at=user.expires_at,
        suspended=bool(user.suspended),
        plan_name=user.plan_name,
        modules=user_modules(user),
        quotas=user_quotas(user),
        accounts_count=owned_accounts_count(db, user),
        last_login=_last_login(db, user.id),
        created_at=user.created_at,
    )


def _plan_public(db: Session, plan: Plan) -> PlanPublic:
    def _loads(raw: str | None, default):
        try:
            data = json.loads(raw or "")
            if isinstance(data, type(default)):
                return data
        except Exception:
            pass
        return default

    count = db.query(User).filter(User.plan_name == plan.name).count()
    return PlanPublic(
        id=plan.id,
        name=plan.name,
        price_label=plan.price_label,
        points=[str(p) for p in _loads(plan.points_json, [])],
        modules=_clean_modules(_loads(plan.modules_json, [])),
        quotas=_clean_quotas(_loads(plan.quotas_json, {})),
        subscribers_count=count,
        created_at=plan.created_at,
    )


def _set_setting(db: Session, key: str, value: str, description: str | None = None, is_secret: bool = False) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        if is_secret:
            row.is_secret = True
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), description=description, is_secret=is_secret))


# --------------------------------------------------------------------------
# Stats & subscribers
# --------------------------------------------------------------------------

@router.get("/modules", response_model=list[ModuleInfo])
def list_modules(admin: PlatformAdmin) -> list[ModuleInfo]:
    return [ModuleInfo(id=m, label=MODULE_LABELS[m]) for m in ALL_MODULES]


@router.get("/stats", response_model=AdminStats)
def admin_stats(db: DbSession, admin: PlatformAdmin) -> AdminStats:
    users = [u for u in db.query(User).all() if not is_platform_admin(u) and u.role != "admin"]
    counts = {"active": 0, "expiring_soon": 0, "expired": 0, "suspended": 0}
    for user in users:
        counts[subscription_status(user)] += 1
    return AdminStats(
        total=len(users),
        active=counts["active"],
        expiring_soon=counts["expiring_soon"],
        expired=counts["expired"],
        suspended=counts["suspended"],
    )


@router.get("/subscribers", response_model=list[SubscriberPublic])
def list_subscribers(db: DbSession, admin: PlatformAdmin) -> list[SubscriberPublic]:
    users = (
        db.query(User)
        .filter(User.role != "admin")
        .order_by(User.created_at.desc())
        .all()
    )
    return [_subscriber_public(db, u) for u in users if not is_platform_admin(u)]


@router.post("/subscribers", response_model=SubscriberPublic, status_code=status.HTTP_201_CREATED)
def create_subscriber(payload: SubscriberCreate, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    email = (payload.email or "").strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=422, detail="البريد الإلكتروني غير صالح")
    if is_platform_admin(User(email=email)):  # constant identity may not be reused
        raise HTTPException(status_code=409, detail="هذا البريد محجوز لإدارة النظام")

    def _email_in_use() -> bool:
        return db.query(User).filter(func.lower(User.email) == email).first() is not None

    if _email_in_use():
        raise HTTPException(status_code=409, detail="هذا البريد مسجّل لمشترك آخر")

    username_base = email.split("@")[0][:40] or "user"
    username, n = username_base, 1
    while db.query(User).filter(User.username == username).first():
        n += 1
        username = f"{username_base}{n}"

    plan_name = payload.plan_name
    modules = _clean_modules(payload.modules)
    quotas = _clean_quotas(payload.quotas)
    if plan_name and not payload.modules:
        plan = db.query(Plan).filter(Plan.name == plan_name).first()
        if plan:
            try:
                modules = _clean_modules(json.loads(plan.modules_json or "[]"))
            except Exception:
                modules = []
            try:
                quotas = _clean_quotas(json.loads(plan.quotas_json or "{}"))
            except Exception:
                quotas = {}

    user = User(
        username=username,
        email=email,
        full_name=None,
        hashed_password=get_password_hash(payload.password),
        role="user",
        is_active=True,
        plan_name=plan_name,
        modules_json=json.dumps(modules, ensure_ascii=False),
        quotas_json=json.dumps(quotas),
        expires_at=_now() + timedelta(days=payload.period_days),
        suspended=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.create",
        message=f"أنشأ المشترك {email} لمدة {payload.period_days} يوم" + (f" على باقة {plan_name}" if plan_name else ""),
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
    )
    return _subscriber_public(db, user)


@router.get("/subscribers/{user_id}", response_model=SubscriberDetail)
def get_subscriber(user_id: int, db: DbSession, admin: PlatformAdmin) -> SubscriberDetail:
    user = _get_subscriber(db, user_id)
    base = _subscriber_public(db, user)
    return SubscriberDetail(
        **base.model_dump(),
        usage_today=user_daily_usage(db, user),
        active_jobs=active_jobs_count(db, user),
    )


@router.put("/subscribers/{user_id}/modules", response_model=SubscriberPublic)
def update_modules(user_id: int, payload: ModulesUpdate, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    user = _get_subscriber(db, user_id)
    modules = _clean_modules(payload.modules)
    user.modules_json = json.dumps(modules, ensure_ascii=False)
    if payload.plan_name is not None:
        user.plan_name = payload.plan_name or None
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.modules",
        message=f"حدّث وحدات المشترك {user.email}: {len(modules)} وحدة",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
    )
    return _subscriber_public(db, user)


@router.put("/subscribers/{user_id}/quotas", response_model=SubscriberPublic)
def update_quotas(user_id: int, payload: QuotasUpdate, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    user = _get_subscriber(db, user_id)
    quotas = _clean_quotas(payload.quotas)
    user.quotas_json = json.dumps(quotas)
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.quotas",
        message=f"حدّث حدود المشترك {user.email}: {quotas}",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
    )
    return _subscriber_public(db, user)


@router.post("/subscribers/{user_id}/extend", response_model=SubscriberPublic)
def extend_subscription(user_id: int, payload: ExtendPayload, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    user = _get_subscriber(db, user_id)
    now = _now()
    current = user.expires_at
    if current is not None and current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    if current and current > now:
        user.expires_at = current + timedelta(days=payload.days)  # accumulate on the tail
    else:
        user.expires_at = now + timedelta(days=payload.days)      # expired: restart from now
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.extend",
        message=f"مدّد اشتراك {user.email} بمقدار {payload.days} يوم حتى {user.expires_at:%Y-%m-%d}",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
    )
    return _subscriber_public(db, user)


@router.post("/subscribers/{user_id}/suspend", response_model=SubscriberPublic)
def suspend_subscriber(user_id: int, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    user = _get_subscriber(db, user_id)
    user.suspended = True
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.suspend",
        message=f"أوقف المشترك {user.email} يدوياً (عداد الاشتراك يستمر)",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
        level="warn",
    )
    return _subscriber_public(db, user)


@router.post("/subscribers/{user_id}/resume", response_model=SubscriberPublic)
def resume_subscriber(user_id: int, db: DbSession, admin: PlatformAdmin) -> SubscriberPublic:
    user = _get_subscriber(db, user_id)
    user.suspended = False
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit_log(
        db,
        action="admin.subscribers.resume",
        message=f"أعاد تفعيل المشترك {user.email}",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
    )
    return _subscriber_public(db, user)


@router.post("/subscribers/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(user_id: int, db: DbSession, admin: PlatformAdmin) -> ResetPasswordResponse:
    user = _get_subscriber(db, user_id)
    new_password = secrets.token_urlsafe(6)  # e.g. 8 visible chars
    user.hashed_password = get_password_hash(new_password)
    db.add(user)
    db.commit()
    write_audit_log(
        db,
        action="admin.subscribers.reset_password",
        message=f"أعاد تعيين كلمة مرور المشترك {user.email}",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
        level="warn",
    )
    return ResetPasswordResponse(email=user.email or user.username, password=new_password)


@router.delete("/subscribers/{user_id}", response_model=dict)
def delete_subscriber(user_id: int, payload: DeleteSubscriberPayload, db: DbSession, admin: PlatformAdmin) -> dict:
    user = _get_subscriber(db, user_id)
    if (payload.confirm_email or "").strip().lower() != (user.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="اكتب بريد المشترك لتأكيد الحذف")

    owned = db.query(Account).filter(Account.owner_user_id == user.id).all()
    if payload.transfer_accounts_to_admin:
        for account in owned:
            account.owner_user_id = admin.id
            db.add(account)
        transferred = len(owned)
    else:
        for account in owned:
            if account.session_file_path:
                from pathlib import Path

                try:
                    Path(account.session_file_path).unlink(missing_ok=True)
                except Exception:
                    pass
            db.delete(account)
        transferred = 0

    db.query(JobRun).filter(JobRun.created_by == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    write_audit_log(
        db,
        action="admin.subscribers.delete",
        message=(
            f"حذف المشترك {user.email}"
            + (f" ونقل {transferred} حساب للأدمن" if transferred else " وحذف بياناته المرتبطة")
        ),
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
        level="warn",
    )
    return {"message": "تم حذف المشترك"}


# --------------------------------------------------------------------------
# Plans
# --------------------------------------------------------------------------

@router.get("/plans", response_model=list[PlanPublic])
def list_plans(db: DbSession, admin: PlatformAdmin) -> list[PlanPublic]:
    return [_plan_public(db, p) for p in db.query(Plan).order_by(Plan.created_at.asc()).all()]


@router.post("/plans", response_model=PlanPublic, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, db: DbSession, admin: PlatformAdmin) -> PlanPublic:
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="اسم الباقة مطلوب")
    if db.query(Plan).filter(Plan.name == name).first():
        raise HTTPException(status_code=409, detail="يوجد باقة بهذا الاسم")
    plan = Plan(
        name=name,
        price_label=payload.price_label,
        points_json=json.dumps([str(p) for p in payload.points], ensure_ascii=False),
        modules_json=json.dumps(_clean_modules(payload.modules), ensure_ascii=False),
        quotas_json=json.dumps(_clean_quotas(payload.quotas)),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    write_audit_log(
        db,
        action="admin.plans.create",
        message=f"أنشأ باقة {name}",
        actor_user_id=admin.id,
        entity_type="plan",
        entity_id=str(plan.id),
    )
    return _plan_public(db, plan)


@router.put("/plans/{plan_id}", response_model=PlanPublic)
def update_plan(plan_id: int, payload: PlanUpdate, db: DbSession, admin: PlatformAdmin) -> PlanPublic:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")
    if payload.name is not None and payload.name.strip() and payload.name.strip() != plan.name:
        if db.query(Plan).filter(Plan.name == payload.name.strip()).first():
            raise HTTPException(status_code=409, detail="يوجد باقة بهذا الاسم")
        old_name = plan.name
        plan.name = payload.name.strip()
        for user in db.query(User).filter(User.plan_name == old_name).all():
            user.plan_name = plan.name
            db.add(user)
    if payload.price_label is not None:
        plan.price_label = payload.price_label
    if payload.points is not None:
        plan.points_json = json.dumps([str(p) for p in payload.points], ensure_ascii=False)
    if payload.modules is not None:
        plan.modules_json = json.dumps(_clean_modules(payload.modules), ensure_ascii=False)
    if payload.quotas is not None:
        plan.quotas_json = json.dumps(_clean_quotas(payload.quotas))
    db.add(plan)

    if payload.apply_to_existing and (payload.modules is not None or payload.quotas is not None):
        for user in db.query(User).filter(User.plan_name == plan.name).all():
            if payload.modules is not None:
                user.modules_json = plan.modules_json
            if payload.quotas is not None:
                user.quotas_json = plan.quotas_json
            db.add(user)
    db.commit()
    db.refresh(plan)
    write_audit_log(
        db,
        action="admin.plans.update",
        message=f"حدّث باقة {plan.name}" + (" وطبّقها على المشتركين الحاليين" if payload.apply_to_existing else ""),
        actor_user_id=admin.id,
        entity_type="plan",
        entity_id=str(plan.id),
    )
    return _plan_public(db, plan)


@router.delete("/plans/{plan_id}", response_model=dict)
def delete_plan(plan_id: int, db: DbSession, admin: PlatformAdmin) -> dict:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")
    # Subscribers on the plan keep their current permissions; plan name is cleared.
    for user in db.query(User).filter(User.plan_name == plan.name).all():
        user.plan_name = None
        db.add(user)
    db.delete(plan)
    db.commit()
    write_audit_log(
        db,
        action="admin.plans.delete",
        message=f"حذف باقة {plan.name}",
        actor_user_id=admin.id,
        entity_type="plan",
        entity_id=str(plan_id),
        level="warn",
    )
    return {"message": "تم حذف الباقة"}


# --------------------------------------------------------------------------
# Usage / broadcast / logs / emergency
# --------------------------------------------------------------------------

@router.get("/usage", response_model=list[UsageRow])
def usage_monitor(db: DbSession, admin: PlatformAdmin) -> list[UsageRow]:
    rows: list[UsageRow] = []
    for user in db.query(User).filter(User.role != "admin").all():
        if is_platform_admin(user):
            continue
        usage = user_daily_usage(db, user)
        rows.append(
            UsageRow(
                user_id=user.id,
                email=user.email or user.username,
                status=subscription_status(user),
                accounts=owned_accounts_count(db, user),
                gather_today=usage["gather"],
                add_today=usage["add"],
                dm_today=usage["dm"],
                group_today=usage["group"],
                quotas=user_quotas(user),
                active_jobs=active_jobs_count(db, user),
            )
        )
    return rows


# Legacy aliases for /admin/settings/telegram — kept so any already-deployed
# frontend build keeps working. They delegate to the hardened implementation
# below (/admin/telegram-api) and never echo the raw hash back.

@router.get("/settings/telegram", response_model=TelegramCredentialsResponse)
def get_admin_telegram_credentials(
    db: DbSession,
    _: PlatformAdmin,
) -> TelegramCredentialsResponse:
    info = _telegram_credentials_public(db)
    return TelegramCredentialsResponse(
        api_id=info.api_id or "",
        api_hash=info.api_hash_masked or "",  # masked — never the real secret
        configured=info.configured,
    )


@router.put("/settings/telegram", response_model=MessageResponse)
def update_admin_telegram_credentials(
    payload: TelegramCredentialsUpdate,
    db: DbSession,
    admin: PlatformAdmin,
) -> MessageResponse:
    update_telegram_api(payload, db, admin)
    return MessageResponse(message="تم حفظ وتطبيق إعدادات API تيليجرام للنظام بالكامل")


@router.post("/broadcast", response_model=MessageResponse)
def broadcast(payload: BroadcastPayload, db: DbSession, admin: PlatformAdmin) -> MessageResponse:
    if payload.audience not in ("all", "active", "expiring_soon"):
        raise HTTPException(status_code=422, detail="الجمهور المستهدف غير معروف")
    sent_at = _now()
    data = {
        "title": payload.title,
        "message": payload.message,
        "audience": payload.audience,
        "sent_at": sent_at.isoformat(),
    }
    _set_setting(db, "broadcast_message", json.dumps(data, ensure_ascii=False), "آخر رسالة بثّ من الإدارة")
    event = NotificationEvent(
        event_type="admin_broadcast",
        level="info",
        title=payload.title,
        message=payload.message,
        details_json=json.dumps({"audience": payload.audience}, ensure_ascii=False),
        delivery_status="sent",
        sent_at=sent_at,
    )
    db.add(event)
    db.commit()
    write_audit_log(
        db,
        action="admin.broadcast",
        message=f"بثّ إشعار ({payload.audience}): {payload.title}",
        actor_user_id=admin.id,
        entity_type="broadcast",
        entity_id=str(event.id),
    )
    return MessageResponse(message="تم إرسال البثّ")


@router.get("/logs", response_model=list[AdminLogEntry])
def admin_logs(
    db: DbSession,
    admin: PlatformAdmin,
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[AdminLogEntry]:
    rows = (
        db.query(ActivityLog)
        .filter(ActivityLog.action.like("admin.%"))
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AdminLogEntry(
            id=r.id,
            created_at=r.created_at,
            level=r.level,
            action=r.action,
            message=r.message,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
        )
        for r in rows
    ]


@router.get("/logs/export")
def admin_logs_export(db: DbSession, admin: PlatformAdmin) -> Response:
    rows = (
        db.query(ActivityLog)
        .filter(ActivityLog.action.like("admin.%"))
        .order_by(ActivityLog.created_at.desc())
        .limit(5000)
        .all()
    )
    buf = io.StringIO()
    buf.write("created_at,level,action,entity,message\n")
    for r in rows:
        safe_message = (r.message or "").replace('"', "'")
        entity = f"{r.entity_type or ''}#{r.entity_id or ''}"
        buf.write(f'{r.created_at.isoformat()},{r.level},{r.action},"{entity}","{safe_message}"\n')
    write_audit_log(
        db,
        action="admin.logs.export",
        message=f"صدّر سجل عمليات الإدارة ({len(rows)} سطر)",
        actor_user_id=admin.id,
        entity_type="logs",
        entity_id="admin",
    )
    return Response(
        content=buf.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="admin-logs.csv"'},
    )


@router.post("/system/lock-clients", response_model=MessageResponse)
def lock_clients(db: DbSession, admin: PlatformAdmin) -> MessageResponse:
    _set_setting(db, "clients_locked", "true", "قفل لوحة العملاء (وضع الطوارئ)")
    db.commit()
    write_audit_log(
        db,
        action="admin.system.lock_clients",
        message="فعّل قفل لوحة العملاء — الأدمن فقط يستطيع الدخول",
        actor_user_id=admin.id,
        entity_type="system",
        entity_id="clients_locked",
        level="warn",
    )
    return MessageResponse(message="تم قفل لوحة العملاء")


@router.post("/system/unlock-clients", response_model=MessageResponse)
def unlock_clients(db: DbSession, admin: PlatformAdmin) -> MessageResponse:
    _set_setting(db, "clients_locked", "false", "قفل لوحة العملاء (وضع الطوارئ)")
    db.commit()
    write_audit_log(
        db,
        action="admin.system.unlock_clients",
        message="فتح لوحة العملاء مجدداً",
        actor_user_id=admin.id,
        entity_type="system",
        entity_id="clients_locked",
    )
    return MessageResponse(message="تم فتح لوحة العملاء")


# --------------------------------------------------------------------------
# Platform Telegram API credentials (owner-managed, applied system-wide)
# --------------------------------------------------------------------------

def _mask_hash(value: str) -> str:
    """Show only the first/last 4 characters of the API hash."""
    value = (value or "").strip()
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}{'•' * max(4, len(value) - 8)}{value[-4:]}"


def _telegram_credentials_public(db: Session) -> TelegramCredentialsPublic:
    from app.services.settings import (
        TELEGRAM_API_HASH_KEY,
        TELEGRAM_API_ID_KEY,
        resolve_telegram_credentials,
    )

    api_id, api_hash, source = resolve_telegram_credentials(db)
    row = db.query(AppSetting).filter(AppSetting.key == TELEGRAM_API_HASH_KEY).first()
    id_row = db.query(AppSetting).filter(AppSetting.key == TELEGRAM_API_ID_KEY).first()
    updated_at = None
    for candidate in (row, id_row):
        if candidate and (updated_at is None or candidate.updated_at > updated_at):
            updated_at = candidate.updated_at

    if source == "database":
        message = "مضبوط من لوحة الإدارة ويُطبَّق تلقائياً على كل المستخدمين والعمليات"
    elif source == "environment":
        message = "مأخوذ من متغيرات البيئة على السيرفر (TELETHON_API_ID / TELETHON_API_HASH) — يمكنك استبداله من هنا"
    else:
        message = "غير مضبوط — لن يتمكن أي مشترك من ربط حساب تيليجرام حتى تضبطه"

    return TelegramCredentialsPublic(
        configured=bool(api_id and api_hash),
        source=source,
        api_id=str(api_id) if api_id else None,
        api_hash_masked=_mask_hash(api_hash or ""),
        has_api_hash=bool(api_hash),
        updated_at=updated_at,
        accounts_linked=db.query(Account).filter(Account.session_file_path.isnot(None)).count(),
        message=message,
    )


@router.get("/telegram-api", response_model=TelegramCredentialsPublic)
def get_telegram_api(db: DbSession, admin: PlatformAdmin) -> TelegramCredentialsPublic:
    """Read the platform-wide Telegram API credentials (owner only)."""
    return _telegram_credentials_public(db)


@router.put("/telegram-api", response_model=TelegramCredentialsPublic)
def update_telegram_api(
    payload: TelegramCredentialsUpdate,
    db: DbSession,
    admin: PlatformAdmin,
) -> TelegramCredentialsPublic:
    """Store the owner's Telegram API ID/Hash; applied instantly system-wide."""
    from app.services.settings import (
        PLACEHOLDER_API_HASH,
        PLACEHOLDER_API_ID,
        TELEGRAM_API_HASH_KEY,
        TELEGRAM_API_ID_KEY,
        get_setting_value,
        set_setting_value,
    )

    api_id = (payload.api_id or "").strip()
    if not api_id.isdigit() or int(api_id) <= 0:
        raise HTTPException(status_code=422, detail="API ID يجب أن يكون رقماً صحيحاً موجباً")

    api_hash = (payload.api_hash or "").strip()
    if not api_hash:
        # Keep the stored hash when the field is left empty (masked in the UI).
        api_hash = (get_setting_value(db, TELEGRAM_API_HASH_KEY) or "").strip()
        if not api_hash:
            raise HTTPException(status_code=422, detail="أدخل API Hash")
    if len(api_hash) < 8:
        raise HTTPException(status_code=422, detail="API Hash غير صالح (قصير جداً)")
    if api_id == PLACEHOLDER_API_ID and api_hash == PLACEHOLDER_API_HASH:
        raise HTTPException(status_code=422, detail="هذه قيم تجريبية وليست بيانات حقيقية من my.telegram.org")

    set_setting_value(
        db,
        TELEGRAM_API_ID_KEY,
        api_id,
        is_secret=True,
        description="Telegram API ID (إدارة المنصة — يُطبَّق على كل النظام)",
        commit=False,
    )
    set_setting_value(
        db,
        TELEGRAM_API_HASH_KEY,
        api_hash,
        is_secret=True,
        description="Telegram API Hash (إدارة المنصة — يُطبَّق على كل النظام)",
        commit=False,
    )
    db.commit()

    write_audit_log(
        db,
        action="admin.telegram_api.update",
        message=f"حدّث بيانات Telegram API للمنصة (API ID: {api_id}) — تُطبَّق على كل المشتركين",
        actor_user_id=admin.id,
        entity_type="settings",
        entity_id="telegram_api",
    )
    return _telegram_credentials_public(db)


@router.post("/telegram-api/test", response_model=MessageResponse)
def test_telegram_api(db: DbSession, admin: PlatformAdmin) -> MessageResponse:
    """Verify the stored credentials by connecting to Telegram (no login)."""
    from app.services.settings import get_telegram_credentials

    try:
        api_id, api_hash = get_telegram_credentials(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        import asyncio

        from telethon import TelegramClient
        from telethon.sessions import StringSession

        async def _probe() -> None:
            client = TelegramClient(StringSession(), api_id, api_hash, device_model="Axogram Pro")
            await client.connect()
            try:
                # Any low-level request validates the api_id/api_hash pair.
                from telethon.tl.functions.help import GetConfigRequest

                await client(GetConfigRequest())
            finally:
                await client.disconnect()

        asyncio.run(_probe())
    except Exception as exc:  # noqa: BLE001 - surfaced to the admin as-is
        raise HTTPException(status_code=400, detail=f"فشل الاتصال بتيليجرام: {exc}") from exc

    write_audit_log(
        db,
        action="admin.telegram_api.test",
        message="اختبر بيانات Telegram API للمنصة بنجاح",
        actor_user_id=admin.id,
        entity_type="settings",
        entity_id="telegram_api",
    )
    return MessageResponse(message="✅ بيانات API صالحة والاتصال بتيليجرام ناجح")
