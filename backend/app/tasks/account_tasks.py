from datetime import datetime, timezone

from app.db.models import Account
from app.db.session import SessionLocal
from app.services.audit import write_audit_log


def validate_accounts_job(account_ids: list[int] | None = None, actor_user_id: int | None = None) -> dict:
    db = SessionLocal()
    try:
        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        rows = query.order_by(Account.id.asc()).all()

        result_rows = []
        active = blocked = restricted = 0
        for row in rows:
            if row.status == "active":
                active += 1
                reason = "الحساب يعمل بشكل طبيعي"
            elif row.status == "blocked":
                blocked += 1
                reason = "الحساب محظور ويحتاج مراجعة أو إزالة"
            else:
                restricted += 1
                reason = "الحساب مقيد ويحتاج تقليل النشاط أو تسخين"

            result_rows.append(
                {
                    "account_id": row.id,
                    "phone": row.phone,
                    "name": row.name,
                    "status": row.status,
                    "reason": reason,
                    "last_checked": datetime.now(timezone.utc).isoformat(),
                }
            )

        summary = {
            "total": len(result_rows),
            "active": active,
            "blocked": blocked,
            "restricted": restricted,
        }

        write_audit_log(
            db,
            action="jobs.accounts.validate",
            message=f"Validated {len(result_rows)} accounts",
            actor_user_id=actor_user_id,
            entity_type="job",
            entity_id="accounts.validate",
        )
        return {"summary": summary, "rows": result_rows, "generated_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()


def warmup_accounts_job(
    account_ids: list[int] | None = None,
    actor_user_id: int | None = None,
    days: int = 7,
    intensity: str = "medium",
) -> dict:
    db = SessionLocal()
    try:
        query = db.query(Account)
        if account_ids:
            query = query.filter(Account.id.in_(account_ids))
        rows = query.order_by(Account.id.asc()).all()

        steps = []
        for row in rows:
            steps.append({
                "phone": row.phone,
                "action": "تهيئة أولية",
                "result": f"خطة {intensity} لمدة {days} يوم",
            })

        write_audit_log(
            db,
            action="jobs.accounts.warmup",
            message=f"Prepared warmup plan for {len(rows)} accounts",
            actor_user_id=actor_user_id,
            entity_type="job",
            entity_id="accounts.warmup",
        )
        return {
            "summary": {
                "target_count": len(rows),
                "days": days,
                "intensity": intensity,
            },
            "steps": steps,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()
