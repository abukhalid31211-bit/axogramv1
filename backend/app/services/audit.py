from sqlalchemy.orm import Session

from app.db.models import ActivityLog


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
