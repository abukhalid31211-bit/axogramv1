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


def _set_setting(db: Session, key: str, value: str, description: str | None = None) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), description=description))


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
