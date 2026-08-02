from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import ActivityLog, User
from app.services.subscription import is_platform_admin


def hide_admin_logs(db: Session, current_user: User, query):
    """Restrict an ActivityLog query so clients never see internal/admin records.

    The permanent platform admin (and any `role=admin` user) must not appear in
    the activity logs shown to clients. When the requesting user *is* the
    platform admin, no filtering is applied.
    """
    if is_platform_admin(current_user):
        return query

    admin_ids: set[int] = set()
    admin_email = (get_settings().platform_admin_email or "").strip().lower()
    if admin_email:
        ids = db.query(User.id).filter(func.lower(User.email) == admin_email).all()
        admin_ids.update(i for (i,) in ids)
    role_ids = db.query(User.id).filter(User.role == "admin").all()
    admin_ids.update(i for (i,) in role_ids)

    if not admin_ids:
        return query

    return query.filter(ActivityLog.actor_user_id.notin_(admin_ids))


def write_audit_log(
    db: Session,
    *,
    action: str,
    message: str,
    actor_user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    level: str = "info",
    details_json: str | None = None,
) -> None:
    db.add(
        ActivityLog(
            action=action,
            message=message,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            level=level,
            details_json=details_json,
        )
    )
    db.commit()
