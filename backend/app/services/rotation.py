"""Rotation engine: daily usage counters and smart account selection."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Account, AppSetting, RotationUsage
from app.services.settings import get_setting_value

settings = get_settings()

OP_COLUMNS = {
    "gather": "gather_count",
    "add": "add_count",
    "dm": "dm_count",
    "group": "group_count",
}


def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def bump_usage(db: Session, account_id: int, op: str, amount: int = 1) -> RotationUsage:
    key = today_key()
    row = db.query(RotationUsage).filter(RotationUsage.account_id == account_id, RotationUsage.usage_date == key).first()
    if not row:
        row = RotationUsage(account_id=account_id, usage_date=key)
        db.add(row)
    column = OP_COLUMNS.get(op, "total_count")
    setattr(row, column, getattr(row, column) + amount)
    row.total_count = (row.gather_count or 0) + (row.add_count or 0) + (row.dm_count or 0) + (row.group_count or 0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def bump_flood(db: Session, account_id: int) -> None:
    key = today_key()
    row = db.query(RotationUsage).filter(RotationUsage.account_id == account_id, RotationUsage.usage_date == key).first()
    if not row:
        row = RotationUsage(account_id=account_id, usage_date=key)
        db.add(row)
    row.flood_waits = (row.flood_waits or 0) + 1
    db.add(row)
    db.commit()


def get_usage(db: Session, account_id: int, usage_date: str | None = None) -> RotationUsage | None:
    return db.query(RotationUsage).filter(RotationUsage.account_id == account_id, RotationUsage.usage_date == (usage_date or today_key())).first()


def get_usage_snapshot(db: Session, usage_date: str | None = None) -> list[dict]:
    key = usage_date or today_key()
    rows = db.query(RotationUsage).filter(RotationUsage.usage_date == key).order_by(RotationUsage.total_count.desc()).all()
    out = []
    for row in rows:
        acc = db.query(Account).filter(Account.id == row.account_id).first()
        if not acc:
            continue
        out.append(
            {
                "account_id": acc.id,
                "phone": acc.phone,
                "name": acc.name,
                "status": acc.status,
                "gather": row.gather_count,
                "add": row.add_count,
                "dm": row.dm_count,
                "group": row.group_count,
                "total": row.total_count,
                "flood_waits": row.flood_waits,
            }
        )
    return out


def reset_usage(db: Session, usage_date: str | None = None) -> int:
    if usage_date:
        deleted = db.query(RotationUsage).filter(RotationUsage.usage_date == usage_date).delete()
    else:
        deleted = db.query(RotationUsage).delete()
    db.commit()
    return deleted


# --------------------------------------------------------------------------
# Exclusion rules
# --------------------------------------------------------------------------

def _setting_bool(db: Session, key: str, default: str = "false") -> bool:
    value = get_setting_value(db, key)
    if value is None:
        return default == "true"
    return str(value).strip().lower() in ("true", "1", "yes", "نعم", "تفعيل")


def _setting_int(db: Session, key: str, default: int) -> int:
    value = get_setting_value(db, key)
    try:
        return int(float(str(value).strip()))
    except Exception:
        return default


def is_working_hours(db: Session, now: datetime | None = None) -> bool:
    now = now or datetime.now()
    if not _setting_bool(db, "rotation_respect_hours", "true"):
        return True
    from_raw = get_setting_value(db, "rotation_work_from") or "08:00"
    to_raw = get_setting_value(db, "rotation_work_to") or "23:00"

    def _minutes(value: str) -> int:
        try:
            parts = str(value).split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 8 * 60

    current = now.hour * 60 + now.minute
    return _minutes(from_raw) <= current < _minutes(to_raw)


def exclusion_rules(db: Session) -> dict:
    return {
        "exclude_blocked": _setting_bool(db, "rotation_exclude_blocked", "true"),
        "exclude_restricted": _setting_bool(db, "rotation_exclude_restricted", "true"),
        "exclude_new_accounts": _setting_bool(db, "rotation_exclude_new", "true"),
        "health_threshold": _setting_int(db, "rotation_health_threshold", 0),
        "flood_threshold": _setting_int(db, "rotation_flood_threshold", 0),
        "require_proxy": _setting_bool(db, "rotation_require_proxy", "false"),
        "respect_hours": _setting_bool(db, "rotation_respect_hours", "true"),
        "work_from": get_setting_value(db, "rotation_work_from") or "08:00",
        "work_to": get_setting_value(db, "rotation_work_to") or "23:00",
    }


def is_excluded(db: Session, account: Account, rules: dict | None = None, usage: RotationUsage | None = None) -> str | None:
    """Return the exclusion reason or None if the account can be used."""
    rules = rules or exclusion_rules(db)
    if account.status == "blocked":
        return "محظور"
    if account.status == "restricted" and rules.get("exclude_restricted"):
        return "مقيد"
    if not account.session_file_path:
        return "بدون جلسة"
    if rules.get("require_proxy") and not account.proxy_id:
        return "بدون بروكسي"
    if rules.get("exclude_new_accounts") and account.created_at:
        age_days = _account_age_days(account)
        if age_days < 30:
            return "حساب جديد (<30 يوم)"
    flood_threshold = rules.get("flood_threshold") or 0
    if flood_threshold and usage and (usage.flood_waits or 0) >= flood_threshold:
        return f"تجاوز حد FloodWait ({usage.flood_waits})"
    return None


def _account_age_days(account: Account) -> int:
    if not account.created_at:
        return 999
    created = account.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - created).days)


def daily_limit_for(db: Session, account: Account, purpose: str) -> int:
    """Daily limit for the given purpose (per account)."""
    key = {"gather": "default_gather_limit", "add": "add_default_daily_limit", "dm": "default_message_limit", "group": "default_campaign_limit"}.get(purpose, "default_add_limit")
    limit = _setting_int(db, key, 20)
    if not limit:
        limit = 20
    # new accounts get reduced limits, old accounts get a small boost
    if account.created_at:
        age_days = _account_age_days(account)
        if age_days < 30:
            limit = max(1, int(limit * 0.5))
        elif age_days > 180:
            limit = int(limit * 1.3)
    return limit


def pick_accounts(db: Session, purpose: str, count: int = 1, exclude_ids: list[int] | None = None) -> list[Account]:
    """Pick the best accounts for an operation (oldest last-used first, within limits)."""
    exclude_ids = exclude_ids or []
    rules = exclusion_rules(db)
    if rules.get("respect_hours") and not is_working_hours(db):
        # still allow, but engines respect the setting; here we don't block hard
        pass
    accounts = db.query(Account).filter(Account.id.notin_(exclude_ids)).order_by(Account.last_used_at.asc().nullsfirst()).all()
    candidates: list[tuple[Account, RotationUsage | None]] = []
    for acc in accounts:
        usage = get_usage(db, acc.id)
        reason = is_excluded(db, acc, rules, usage)
        if reason:
            continue
        limit = daily_limit_for(db, acc, purpose)
        used = (usage.total_count or 0) if usage else 0
        if used >= limit:
            continue
        candidates.append((acc, usage))
    if not candidates:
        return []

    def _sort_key(pair):
        acc, usage = pair
        used = usage.total_count if usage else 0
        last_used = acc.last_used_at
        if last_used is None:
            last_used = datetime.min.replace(tzinfo=timezone.utc)
        elif last_used.tzinfo is None:
            last_used = last_used.replace(tzinfo=timezone.utc)
        return (used, last_used)

    candidates.sort(key=_sort_key)
    return [acc for acc, _ in candidates[:count]]


def mark_used(db: Session, account: Account, purpose: str, amount: int = 1) -> None:
    from datetime import datetime, timezone as tz

    account.last_used_at = datetime.now(tz.utc)
    account.last_used_label = "الآن"
    db.add(account)
    bump_usage(db, account.id, purpose, amount)


def load_op_settings(db: Session, source: str = "defaults") -> dict:
    """Load operation settings from AppSetting (or a stored JSON for campaigns)."""
    prefix = source if source != "defaults" else "add_default"
    keys = {
        "delay_min": f"{prefix}_delay_min" if prefix != "add_default" else "add_default_delay_from",
        "delay_max": f"{prefix}_delay_max" if prefix != "add_default" else "add_default_delay_to",
        "daily_limit": f"{prefix}_daily_limit",
        "switch_count": f"{prefix}_switch_count",
        "flood_action": f"{prefix}_flood_action",
        "ban_action": f"{prefix}_ban_action",
        "privacy_action": f"{prefix}_privacy_action",
    }
    out = {}
    for name, key in keys.items():
        out[name] = get_setting_value(db, key)
    defaults = {
        "delay_min": "60",
        "delay_max": "120",
        "daily_limit": "20",
        "switch_count": "5",
        "flood_action": "wait",
        "ban_action": "remove",
        "privacy_action": "skip",
    }
    for name, value in defaults.items():
        if not out[name]:
            out[name] = value
    return out


def load_campaign_settings(db: Session, campaign) -> dict:
    """Merge stored campaign settings_json with defaults."""
    base = load_op_settings(db, "defaults")
    stored: dict = {}
    if campaign.settings_json:
        try:
            stored = json.loads(campaign.settings_json)
        except Exception:
            stored = {}
    merged = {**base, **stored}
    return merged
