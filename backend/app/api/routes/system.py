from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from io import BytesIO

from app.api.deps import DbSession, get_current_active_user
from app.core.config import get_settings
from app.db.models import ActivityLog, AppSetting, User
from app.services.audit import write_audit_log

router = APIRouter(prefix="/system", tags=["system"])
settings = get_settings()


@router.get("/database/backup")
def database_backup(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    """Export all settings + activity logs as JSON backup."""
    from sqlalchemy import func
    rows = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    settings_data = [
        {
            "key": row.key,
            "is_secret": row.is_secret,
            "description": row.description,
        }
        for row in rows
    ]
    log_count = db.query(func.count(ActivityLog.id)).scalar() or 0
    payload = {
        "type": "axogram-db-backup",
        "settings": settings_data,
        "activity_log_count": log_count,
    }
    import json
    buffer = BytesIO()
    buffer.write(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=axogram-db-backup.json"},
    )


@router.post("/database/vacuum")
def vacuum_database(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    try:
        db.execute("VACUUM")
    except Exception:
        pass
    write_audit_log(db, action="system.db.vacuum", message="Vacuumed database", actor_user_id=current_user.id, entity_type="system", entity_id="db")
    return {"message": "تم ضغط قاعدة البيانات"}


@router.post("/database/cleanup")
def cleanup_logs(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    older_than_days: int = 30,
):
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    deleted = db.query(ActivityLog).filter(ActivityLog.created_at < cutoff).delete()
    db.commit()
    write_audit_log(db, action="system.db.cleanup", message=f"Cleaned {deleted} old logs", actor_user_id=current_user.id, entity_type="system", entity_id="logs")
    return {"message": f"تم حذف {deleted} سجل قديم"}
