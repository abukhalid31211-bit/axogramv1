from sqlalchemy.orm import Session

from app.core.crypto import encrypt_value
from app.core.security import get_password_hash
from app.db.models import Account, AppSetting, Campaign, Proxy, User


DEFAULT_SETTINGS = [
    ("telegram_api_id", "12345678", True, "Telegram API ID"),
    ("telegram_api_hash", "a1b2c3d4e5f6", True, "Telegram API Hash"),
    ("default_add_limit", "20", False, "Daily add limit"),
    ("default_gather_limit", "500", False, "Daily gather limit"),
    ("default_message_limit", "30", False, "Daily DM limit"),
    ("default_delay_min", "60", False, "Minimum delay in seconds"),
    ("default_delay_max", "120", False, "Maximum delay in seconds"),
    ("sessions_path", "./sessions/", False, "Sessions path"),
    ("exports_path", "./exports/", False, "Exports path"),
    ("logs_path", "./logs/", False, "Logs path"),
    ("language", "AR", False, "Dashboard language"),
]


DEFAULT_PROXIES = [
    {"address": "185.12.45.10:1080", "proxy_type": "SOCKS5", "status": "active", "speed_ms": 120},
    {"address": "94.21.10.5:1080", "proxy_type": "SOCKS5", "status": "active", "speed_ms": 210},
    {"address": "77.40.22.8:1080", "proxy_type": "SOCKS4", "status": "active", "speed_ms": 95},
    {"address": "203.0.113.5:8080", "proxy_type": "HTTP", "status": "dead", "speed_ms": None},
    {"address": "198.51.100.7:1080", "proxy_type": "SOCKS5", "status": "slow", "speed_ms": 880},
]


DEFAULT_ACCOUNTS = [
    {"phone": "+966501234567", "name": "أحمد", "username": "@ahmed", "status": "active", "proxy_index": 0, "last_used_label": "قبل 5 دقائق", "age_label": "8 أشهر", "groups_count": 14},
    {"phone": "+966552345678", "name": "سارة", "username": "@sara", "status": "active", "proxy_index": None, "last_used_label": "قبل ساعة", "age_label": "3 أشهر", "groups_count": 8},
    {"phone": "+966563456789", "name": "خالد", "username": "@khaled", "status": "restricted", "proxy_index": 1, "last_used_label": "أمس", "age_label": "سنة", "groups_count": 22},
    {"phone": "+966574567890", "name": "نورة", "username": "@noura", "status": "blocked", "proxy_index": None, "last_used_label": "قبل 3 أيام", "age_label": "شهر", "groups_count": 0},
    {"phone": "+966585678901", "name": "فهد", "username": "@fahd", "status": "active", "proxy_index": 2, "last_used_label": "قبل 10 دقائق", "age_label": "سنتان", "groups_count": 31},
    {"phone": "+966596789012", "name": "ريم", "username": "@reem", "status": "active", "proxy_index": None, "last_used_label": "قبل 30 دقيقة", "age_label": "5 أشهر", "groups_count": 11},
]


DEFAULT_CAMPAIGNS = [
    {"name": "حملة تسويق منتج", "kind": "group", "status": "active", "progress": 72, "sent": 63, "total": 87},
    {"name": "حملة تداول", "kind": "group", "status": "done", "progress": 100, "sent": 120, "total": 120},
    {"name": "DM تسويق", "kind": "dm", "status": "active", "progress": 45, "sent": 450, "total": 1000},
]


def ensure_initial_data(
    db: Session,
    *,
    superuser_username: str,
    superuser_password: str,
    superuser_full_name: str,
) -> None:
    if not db.query(User).filter(User.username == superuser_username).first():
        db.add(
            User(
                username=superuser_username,
                full_name=superuser_full_name,
                hashed_password=get_password_hash(superuser_password),
                role="admin",
                is_active=True,
            )
        )
        db.commit()

    for key, value, is_secret, description in DEFAULT_SETTINGS:
        if not db.query(AppSetting).filter(AppSetting.key == key).first():
            db.add(
                AppSetting(
                    key=key,
                    value_encrypted=encrypt_value(value),
                    is_secret=is_secret,
                    description=description,
                )
            )
    db.commit()

    if db.query(Proxy).count() == 0:
        for item in DEFAULT_PROXIES:
            db.add(Proxy(**item))
        db.commit()

    proxies = db.query(Proxy).order_by(Proxy.id.asc()).all()

    if db.query(Account).count() == 0:
        for item in DEFAULT_ACCOUNTS:
            proxy = proxies[item["proxy_index"]] if item["proxy_index"] is not None and item["proxy_index"] < len(proxies) else None
            db.add(
                Account(
                    phone=item["phone"],
                    name=item["name"],
                    username=item["username"],
                    status=item["status"],
                    proxy_id=proxy.id if proxy else None,
                    last_used_label=item["last_used_label"],
                    age_label=item["age_label"],
                    groups_count=item["groups_count"],
                )
            )
        db.commit()

    if db.query(Campaign).count() == 0:
        for item in DEFAULT_CAMPAIGNS:
            db.add(Campaign(**item))
        db.commit()
