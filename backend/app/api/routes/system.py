from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from io import BytesIO

from app.api.deps import DbSession, get_current_active_user
from app.core.config import get_settings
from app.db.models import Account, ActivityLog, AppSetting, Campaign, MessageTemplate, Proxy, ProxyPool, User
from app.services.audit import write_audit_log

router = APIRouter(prefix="/system", tags=["system"])
settings = get_settings()


@router.get("/database/backup")
def database_backup(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    """Full backup: settings + accounts + proxies + campaigns + templates + groups."""
    from sqlalchemy import func

    from app.core.crypto import decrypt_value

    settings_rows = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    settings_data = []
    for row in settings_rows:
        try:
            value = decrypt_value(row.value_encrypted)
        except Exception:
            value = None
        settings_data.append({"key": row.key, "value": value, "is_secret": row.is_secret, "description": row.description})
    proxies = [{"address": p.address, "proxy_type": p.proxy_type, "status": p.status, "auth_login": p.auth_login, "notes": p.notes} for p in db.query(Proxy).all()]
    accounts = [
        {"phone": a.phone, "name": a.name, "username": a.username, "status": a.status, "groups_count": a.groups_count, "age_label": a.age_label, "notes": a.notes}
        for a in db.query(Account).all()
    ]
    campaigns = [
        {"name": c.name, "kind": c.kind, "status": c.status, "message_text": c.message_text, "message_kind": c.message_kind, "groups_json": c.groups_json, "recipients_json": c.recipients_json, "settings_json": c.settings_json}
        for c in db.query(Campaign).all()
    ]
    templates = [{"name": t.name, "kind": t.kind, "message_kind": t.message_kind, "category": t.category, "content": t.content} for t in db.query(MessageTemplate).all()]
    log_count = db.query(func.count(ActivityLog.id)).scalar() or 0
    payload = {
        "type": "axogram-db-backup",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "settings": settings_data,
        "proxies": proxies,
        "accounts": accounts,
        "campaigns": campaigns,
        "templates": templates,
        "activity_log_count": log_count,
    }
    import json

    buffer = BytesIO()
    buffer.write(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=axogram-backup.json"},
    )


@router.post("/database/restore")
async def database_restore(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], file: UploadFile = File(...)):
    """Restore settings/accounts/proxies/campaigns/templates from a backup file."""
    import json

    from app.core.crypto import encrypt_value
    from app.db.models import GatherExport, RotationUsage, SecurityEvent, TelegramAuthSession

    content = (await file.read()).decode("utf-8", errors="replace")
    try:
        payload = json.loads(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ملف النسخة الاحتياطية غير صالح: {exc}") from exc
    if payload.get("type") != "axogram-db-backup":
        raise HTTPException(status_code=400, detail="الملف ليس نسخة احتياطية صالحة للنظام")

    # Settings
    restored_settings = 0
    for item in payload.get("settings", []):
        key = item.get("key")
        if not key:
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value_encrypted = encrypt_value(str(item.get("value") or ""))
            row.is_secret = bool(item.get("is_secret"))
            row.description = item.get("description")
            db.add(row)
        else:
            db.add(AppSetting(key=key, value_encrypted=encrypt_value(str(item.get("value") or "")), is_secret=bool(item.get("is_secret")), description=item.get("description")))
        restored_settings += 1

    # Proxies (append missing)
    for item in payload.get("proxies", []):
        if not db.query(Proxy).filter(Proxy.address == item.get("address")).first():
            db.add(Proxy(address=item.get("address"), proxy_type=item.get("proxy_type", "SOCKS5"), status=item.get("status", "active"), auth_login=item.get("auth_login"), notes=item.get("notes")))

    # Accounts (append missing)
    for item in payload.get("accounts", []):
        if not db.query(Account).filter(Account.phone == item.get("phone")).first():
            db.add(Account(phone=item.get("phone"), name=item.get("name") or item.get("phone"), username=item.get("username"), status=item.get("status", "active"), groups_count=item.get("groups_count", 0), age_label=item.get("age_label"), notes=item.get("notes")))

    # Campaigns (append missing by name)
    for item in payload.get("campaigns", []):
        if not db.query(Campaign).filter(Campaign.name == item.get("name")).first():
            db.add(Campaign(name=item.get("name"), kind=item.get("kind", "group"), status=item.get("status", "draft"), message_text=item.get("message_text"), message_kind=item.get("message_kind", "text"), groups_json=item.get("groups_json"), recipients_json=item.get("recipients_json"), settings_json=item.get("settings_json")))

    # Templates
    for item in payload.get("templates", []):
        if not db.query(MessageTemplate).filter(MessageTemplate.name == item.get("name")).first():
            db.add(MessageTemplate(name=item.get("name"), kind=item.get("kind", "group"), message_kind=item.get("message_kind", "text"), category=item.get("category"), content=item.get("content", "")))

    db.commit()
    write_audit_log(db, action="system.db.restore", message=f"استعادة نسخة احتياطية ({restored_settings} إعداد، إلخ)", actor_user_id=current_user.id, entity_type="system", entity_id="db", level="warn")
    return {"message": "تمت استعادة النسخة الاحتياطية بنجاح", "restored_settings": restored_settings}


@router.post("/database/vacuum")
def vacuum_database(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    from sqlalchemy import text

    try:
        db.execute(text("VACUUM"))
    except Exception:
        pass
    write_audit_log(db, action="system.db.vacuum", message="ضغط قاعدة البيانات", actor_user_id=current_user.id, entity_type="system", entity_id="db")
    return {"message": "تم ضغط قاعدة البيانات"}


@router.post("/database/cleanup")
def cleanup_logs(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], older_than_days: int = 30):
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    deleted = db.query(ActivityLog).filter(ActivityLog.created_at < cutoff).delete()
    db.commit()
    write_audit_log(db, action="system.db.cleanup", message=f"حذف {deleted} سجل قديم", actor_user_id=current_user.id, entity_type="system", entity_id="logs")
    return {"message": f"تم حذف {deleted} سجل قديم"}


@router.get("/info")
def system_info(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    """Real system information (process, storage, DB counts)."""
    import platform
    import sys
    from pathlib import Path

    from sqlalchemy import func

    storage = settings.storage_path
    total_files = sum(1 for _ in storage.rglob("*") if _.is_file()) if storage.exists() else 0
    total_size = sum(f.stat().st_size for f in storage.rglob("*") if f.is_file()) if storage.exists() else 0

    def _size(value: int) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if value < 1024:
                return f"{value:.1f} {unit}"
            value /= 1024
        return f"{value:.1f} TB"

    try:
        import psutil  # type: ignore

        cpu = psutil.cpu_percent(interval=0.2)
        ram = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
        uptime_seconds = int(__import__("time").time() - psutil.boot_time())
        uptime = f"{uptime_seconds // 86400} يوم {(uptime_seconds % 86400) // 3600} ساعة"
    except Exception:
        cpu = ram = disk = 0
        uptime = "غير متاح"

    return {
        "version": "1.0.0",
        "python": sys.version.split()[0],
        "os": platform.system() + " " + platform.release(),
        "cpu": f"{cpu}%",
        "ram": f"{ram}%",
        "storage_disk": f"{disk}%",
        "storage_files": total_files,
        "storage_size": _size(total_size),
        "uptime": uptime,
        "database": "PostgreSQL",
        "counts": {
            "accounts": db.query(func.count(Account.id)).scalar() or 0,
            "proxies": db.query(func.count(Proxy.id)).scalar() or 0,
            "campaigns": db.query(func.count(Campaign.id)).scalar() or 0,
            "users": db.query(func.count(User.id)).scalar() or 0,
        },
    }
