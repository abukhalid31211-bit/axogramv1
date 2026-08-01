from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, ActivityLog, Campaign, Proxy, User
from app.schemas.report import ActivityLogPublic, DashboardSummary

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard_summary(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> DashboardSummary:
    accounts_total = db.query(func.count(Account.id)).scalar() or 0
    accounts_active = db.query(func.count(Account.id)).filter(Account.status == "active").scalar() or 0
    proxies_total = db.query(func.count(Proxy.id)).scalar() or 0
    proxies_active = db.query(func.count(Proxy.id)).filter(Proxy.status == "active").scalar() or 0
    campaigns_total = db.query(func.count(Campaign.id)).scalar() or 0
    campaigns_active = db.query(func.count(Campaign.id)).filter(Campaign.status == "active").scalar() or 0
    last_activity = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).first()
    return DashboardSummary(
        accounts_total=accounts_total,
        accounts_active=accounts_active,
        proxies_total=proxies_total,
        proxies_active=proxies_active,
        campaigns_total=campaigns_total,
        campaigns_active=campaigns_active,
        last_activity_at=last_activity.created_at if last_activity else None,
    )


@router.get("/activity", response_model=list[ActivityLogPublic])
def recent_activity(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: int = 20,
) -> list[ActivityLogPublic]:
    rows = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [ActivityLogPublic.model_validate(row) for row in rows]
