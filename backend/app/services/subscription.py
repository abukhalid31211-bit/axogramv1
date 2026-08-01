"""Subscription / admin-panel logic: platform admin identification, module
gating, per-user quotas, expiry sweeping and retention purge."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Account, Campaign, RotationUsage, User

settings = get_settings()

ALL_MODULES: list[str] = [
    "accounts", "gather", "add", "rotation", "proxy",
    "massdm", "campaigns", "reports", "security", "settings",
]

MODULE_LABELS: dict[str, str] = {
    "accounts": "مدير الحسابات",
    "gather": "تجميع الأعضاء",
    "add": "إضافة الأعضاء",
    "rotation": "نظام التدوير",
    "proxy": "مدير البروكسي",
    "massdm": "الرسائل الجماعية",
    "campaigns": "حملات القروبات",
    "reports": "التقارير والسجلات",
    "security": "أدوات الأمان",
    "settings": "الإعدادات",
}

DEFAULT_QUOTAS: dict[str, int] = {
    "accounts_limit": 0,      # 0 = unlimited
    "gather_daily": 0,
    "add_daily": 0,
    "dm_daily": 0,
    "group_daily": 0,
    "concurrent_jobs": 0,
}

WARN_SOON_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# --------------------------------------------------------------------------
# Platform admin
# --------------------------------------------------------------------------

def admin_email() -> str:
    return (settings.platform_admin_email or "").strip().lower()


def is_platform_admin(user: User | None) -> bool:
    if not user:
        return False
    return (user.email or "").strip().lower() == admin_email()


# --------------------------------------------------------------------------
# JSON helpers
# --------------------------------------------------------------------------

def user_modules(user: User) -> list[str]:
    if is_platform_admin(user):
        return list(ALL_MODULES)
    try:
        modules = json.loads(user.modules_json or "[]")
        if isinstance(modules, list):
            return [str(m) for m in modules if str(m) in ALL_MODULES]
    except Exception:
        pass
    return list(ALL_MODULES) if user.modules_json is None else []


def user_quotas(user: User) -> dict[str, int]:
    quotas = dict(DEFAULT_QUOTAS)
    try:
        stored = json.loads(user.quotas_json or "{}")
        if isinstance(stored, dict):
            for key, value in stored.items():
                if key in quotas:
                    try:
                        quotas[key] = int(value)
                    except Exception:
                        continue
    except Exception:
        pass
    return quotas


def module_allowed(user: User, module: str) -> bool:
    if is_platform_admin(user):
        return True
    return module in user_modules(user)


# --------------------------------------------------------------------------
# Subscription status
# --------------------------------------------------------------------------

def subscription_status(user: User) -> str:
    """active | expiring_soon | expired | suspended (platform admin is always active)."""
    if is_platform_admin(user):
        return "active"
    if user.suspended:
        return "suspended"
    expires = _aware(user.expires_at)
    if expires is None:
        return "active"
    now = _now()
    if expires <= now:
        return "expired"
    if expires <= now + timedelta(days=WARN_SOON_DAYS):
        return "expiring_soon"
    return "active"


def remaining_seconds(user: User) -> int | None:
    expires = _aware(user.expires_at)
    if expires is None:
        return None
    return int((expires - _now()).total_seconds())


def remaining_label(user: User) -> str | None:
    seconds = remaining_seconds(user)
    if seconds is None:
        return "بدون انتهاء"
    if seconds <= 0:
        return "منتهٍ"
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    if days > 0:
        return f"{days} يوم {hours} ساعة"
    minutes = (seconds % 3600) // 60
    return f"{hours} ساعة {minutes} دقيقة"


def blocked_reason(user: User) -> str | None:
    """Reason the user must be rejected, or None. (Used on every API request.)"""
    status = subscription_status(user)
    if status == "suspended":
        return "الحساب موقوف مؤقتاً من الإدارة — تواصل مع المسؤول"
    if status == "expired":
        return "انتهت فترة اشتراكك — تواصل مع المسؤول للتجديد"
    return None


# --------------------------------------------------------------------------
# Serialization
# --------------------------------------------------------------------------

def to_user_public(user: User):
    """Build the extended public user payload (subscription fields included)."""
    from app.schemas.auth import UserPublic

    return UserPublic(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        platform_admin=is_platform_admin(user),
        plan_name=user.plan_name,
        modules=user_modules(user),
        quotas=user_quotas(user),
        expires_at=_aware(user.expires_at),
        suspended=bool(user.suspended),
        subscription_status=subscription_status(user),
        remaining_seconds=remaining_seconds(user),
    )


# --------------------------------------------------------------------------
# Quotas
# --------------------------------------------------------------------------

def user_daily_usage(db: Session, user: User) -> dict[str, int]:
    """Sum today's RotationUsage across accounts owned by this user."""
    from app.services.rotation import today_key

    key = today_key()
    query = (
        db.query(RotationUsage)
        .join(Account, RotationUsage.account_id == Account.id)
        .filter(RotationUsage.usage_date == key, Account.owner_user_id == user.id)
    )
    totals = {"gather": 0, "add": 0, "dm": 0, "group": 0, "flood": 0}
    for row in query.all():
        totals["gather"] += row.gather_count or 0
        totals["add"] += row.add_count or 0
        totals["dm"] += row.dm_count or 0
        totals["group"] += row.group_count or 0
        totals["flood"] += row.flood_waits or 0
    return totals


def owned_accounts_count(db: Session, user: User) -> int:
    if is_platform_admin(user):
        return db.query(Account).count()
    return db.query(Account).filter(Account.owner_user_id == user.id).count()


def quota_error(db: Session, user: User, purpose: str) -> str | None:
    """Return an Arabic error when the user exceeded the quota for `purpose`."""
    if is_platform_admin(user):
        return None
    quotas = user_quotas(user)
    if purpose == "account_link" and quotas["accounts_limit"]:
        current = owned_accounts_count(db, user)
        if current >= quotas["accounts_limit"]:
            return f"وصلت أقصى عدد حسابات في خطتك ({quotas['accounts_limit']} حساب) — اطلب ترقية من الإدارة"
        return None
    key_map = {"gather": ("gather", "gather_daily", "تجميع"), "add": ("add", "add_daily", "إضافة"), "dm": ("dm", "dm_daily", "رسائل DM"), "group": ("group", "group_daily", "رسائل قروبات")}
    if purpose in key_map:
        usage_key, quota_key, label = key_map[purpose]
        limit = quotas.get(quota_key) or 0
        if limit:
            used = user_daily_usage(db, user).get(usage_key, 0)
            if used >= limit:
                return f"وصلت حدّك اليومي ({limit} {label}) — يتجدد غداً أو اطلب ترقية من الإدارة"
    return None


def assert_user_allows(db: Session, user_id: int | None, purpose: str) -> None:
    """Raise ValueError when the job owner became expired/suspended/over-quota.
    Called by long-running engines every few iterations."""
    if not user_id:
        return
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("مالك المهمة لم يعد موجوداً")
    reason = blocked_reason(user)
    if reason:
        raise ValueError(reason)
    err = quota_error(db, user, purpose)
    if err:
        raise ValueError(err)


def owner_scope_for(db: Session, actor_user_id: int | None) -> int | None:
    """Account-picker scope: None = all accounts (platform admin / system), else the user's id."""
    if not actor_user_id:
        return None
    user = db.query(User).filter(User.id == actor_user_id).first()
    if not user or is_platform_admin(user) or user.role == "admin":
        return None
    return actor_user_id


def active_jobs_count(db: Session, user: User) -> int:
    from app.db.models import JobRun

    return (
        db.query(JobRun)
        .filter(JobRun.created_by == user.id, JobRun.status.in_(["queued", "running", "paused"]))
        .count()
    )


def concurrent_jobs_error(db: Session, user: User) -> str | None:
    if is_platform_admin(user):
        return None
    limit = user_quotas(user).get("concurrent_jobs") or 0
    if limit and active_jobs_count(db, user) >= limit:
        return f"وصلت أقصى عدد مهام متزامنة في خطتك ({limit} مهمة) — انتظر اكتمال مهمة حالية"
    return None


# --------------------------------------------------------------------------
# Expiry sweep + retention purge (called by the scheduler loop)
# --------------------------------------------------------------------------

def sweep_expired_users(db: Session) -> int:
    """Stop jobs of subscribers whose subscription just expired (or suspended)."""
    from app.db.models import JobRun

    now = _now()
    users = (
        db.query(User)
        .filter(User.role != "admin")
        .all()
    )
    stopped = 0
    for user in users:
        if is_platform_admin(user):
            continue
        status_ = subscription_status(user)
        if status_ not in ("expired", "suspended"):
            continue
        runs = (
            db.query(JobRun)
            .filter(JobRun.created_by == user.id, JobRun.status.in_(["queued", "running", "paused"]))
            .all()
        )
        for run in runs:
            run.control = "cancel"
            if run.status in ("queued",):
                run.status = "cancelled"
                run.ended_at = now
            db.add(run)
            stopped += 1
    if stopped:
        db.commit()
    return stopped


def purge_expired_users(db: Session) -> int:
    """Delete subscribers whose expiry passed more than `retention_days` ago."""
    from app.db.models import JobRun
    from app.services.audit import write_audit_log

    retention = max(1, int(settings.expired_retention_days or 30))
    cutoff = _now() - timedelta(days=retention)
    purged = 0
    for user in db.query(User).filter(User.role != "admin").all():
        if is_platform_admin(user):
            continue
        expires = _aware(user.expires_at)
        if expires is None or expires > cutoff:
            continue
        # remove their data: sessions/files of owned accounts, jobs
        for account in db.query(Account).filter(Account.owner_user_id == user.id).all():
            if account.session_file_path:
                from pathlib import Path

                try:
                    Path(account.session_file_path).unlink(missing_ok=True)
                except Exception:
                    pass
            db.delete(account)
        db.query(JobRun).filter(JobRun.created_by == user.id).delete()
        write_audit_log(
            db,
            action="admin.subscribers.purged",
            message=f"حُذف اشتراك {user.email} نهائياً بعد انتهائه بأكثر من {retention} يوم دون تجديد",
            entity_type="user",
            entity_id=str(user.id),
            level="warn",
        )
        db.delete(user)
        purged += 1
    if purged:
        db.commit()
    return purged
