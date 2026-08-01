import json

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import encrypt_value
from app.core.security import get_password_hash
from app.db.models import Account, AppSetting, Campaign, MessageTemplate, Plan, Proxy, User


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


def _ensure_platform_admin(db: Session, superuser_username: str, superuser_password: str, superuser_full_name: str) -> User:
    """Guarantee the permanent platform admin exists and carries the admin e-mail.

    Migration from username login: the old `admin` user gets the platform e-mail
    assigned so it can log in with e-mail+password from now on.
    """
    settings = get_settings()
    email = (settings.platform_admin_email or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = "admin"
        user.is_active = True
        user.suspended = False
        user.expires_at = None
        db.add(user)
        db.commit()
        return user

    user = db.query(User).filter(User.username == superuser_username).first()
    if not user:
        user = (
            db.query(User)
            .filter(User.role == "admin")
            .order_by(User.id.asc())
            .first()
        )
    if not user:
        user = User(
            username=superuser_username,
            full_name=superuser_full_name,
            hashed_password=get_password_hash(superuser_password),
            role="admin",
            is_active=True,
            email=email,
        )
        db.add(user)
    else:
        if email and not user.email:
            user.email = email
        user.role = "admin"
        user.is_active = True
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


DEFAULT_PLANS = [
    {
        "name": "🟦 مُجمِّع",
        "price_label": "اقتصادية",
        "points": ["تجميع أعضاء", "تقارير بسيطة", "3 حسابات"],
        "modules": ["gather", "reports", "accounts"],
        "quotas": {"accounts_limit": 3, "gather_daily": 2000},
    },
    {
        "name": "🟩 مُسوِّق",
        "price_label": "احترافية",
        "points": ["تجميع + إضافة", "رسائل DM", "10 حسابات"],
        "modules": ["gather", "add", "massdm", "rotation", "reports", "accounts", "proxy"],
        "quotas": {"accounts_limit": 10, "gather_daily": 500, "add_daily": 20, "dm_daily": 30},
    },
    {
        "name": "🟨 شاملة",
        "price_label": "VIP",
        "points": ["كل الوحدات", "حدود النظام", "50 حساب"],
        "modules": ["accounts", "gather", "add", "rotation", "proxy", "massdm", "campaigns", "reports", "security", "settings"],
        "quotas": {"accounts_limit": 50},
    },
]


def _ensure_default_plans(db: Session) -> None:
    for item in DEFAULT_PLANS:
        if db.query(Plan).filter(Plan.name == item["name"]).first():
            continue
        db.add(
            Plan(
                name=item["name"],
                price_label=item["price_label"],
                points_json=json.dumps(item["points"], ensure_ascii=False),
                modules_json=json.dumps(item["modules"]),
                quotas_json=json.dumps(item["quotas"]),
            )
        )
    db.commit()


def ensure_initial_data(
    db: Session,
    *,
    superuser_username: str,
    superuser_password: str,
    superuser_full_name: str,
) -> None:
    _ensure_platform_admin(db, superuser_username, superuser_password, superuser_full_name)
    _ensure_default_plans(db)

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

    if db.query(MessageTemplate).count() == 0:
        for item in [
            {"name": "قالب ترحيبي", "kind": "group", "message_kind": "text", "category": "ترحيب", "content": "أهلاً بك في قناتنا! اشترك للمزيد"},
            {"name": "عرض المنتج", "kind": "dm", "message_kind": "image", "category": "تسويق", "content": "تفضل عرضنا الجديد 👇"},
            {"name": "متابعة", "kind": "dm", "message_kind": "text", "category": "متابعة", "content": "هل تفضل الاستمرار؟"},
            {"name": "إعلان", "kind": "group", "message_kind": "video", "category": "إعلان", "content": "شاهد الفيديو الجديد"},
        ]:
            db.add(MessageTemplate(**item))
        db.commit()
