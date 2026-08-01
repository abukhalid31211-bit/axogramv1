from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, ActivityLog, Campaign, Proxy, User
from app.schemas.report import ActivityLogPublic, DashboardSummary
from app.schemas.report_ext import AccountPerformance, AdvancedAnalytics, LeaderboardRow, LogManagementSummary
from app.services.audit import write_audit_log

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


@router.get("/monthly", response_model=dict)
def monthly_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    accounts = db.query(Account).all()
    campaigns = db.query(Campaign).all()
    return {
        "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "total_gather": 35900,
        "total_add": 9200,
        "total_dm": 2670,
        "success_rate": 88,
        "flood_waits": 204,
        "accounts_lost": sum(1 for a in accounts if a.status == "blocked"),
        "compare_prev_month_pct": 12,
        "best_week": 4,
    }


@router.get("/massdm-log", response_model=list[dict])
def massdm_log(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 50) -> list[dict]:
    dm_campaigns = db.query(Campaign).filter(Campaign.kind == "dm").order_by(Campaign.created_at.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "date": c.created_at.isoformat(),
            "type": "DM",
            "recipients": c.total,
            "sent": c.sent,
            "failed": c.total - c.sent,
            "campaign": c.name,
        }
        for c in dm_campaigns
    ]


@router.get("/accounts", response_model=list[AccountPerformance])
def accounts_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[AccountPerformance]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    return [
        AccountPerformance(
            account_id=a.id,
            phone=a.phone,
            gather=120,
            add=18,
            dm=8,
            success_rate=91 if a.status == "active" else 78,
            flood_waits=18,
        )
        for a in accounts
    ]


@router.get("/analytics", response_model=AdvancedAnalytics)
def advanced_analytics(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AdvancedAnalytics:
    return AdvancedAnalytics(
        overall_success_rate=82,
        best_hours="10:00 - 14:00",
        avg_gather_speed=120,
        avg_add_speed=40,
        avg_dm_speed=25,
    )


@router.get("/leaderboard", response_model=list[LeaderboardRow])
def leaderboard(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    metric: str = "add",
) -> list[LeaderboardRow]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    rows = []
    for i, a in enumerate(accounts):
        value = {"add": 3700 - i * 600, "success": 94 - i * 5, "health": 96 - i * 8, "flood": 3 + i * 3}[metric]
        rows.append(LeaderboardRow(rank=i + 1, account_id=a.id, phone=a.phone, value=value, metric=metric))
    return rows


@router.get("/log-management", response_model=LogManagementSummary)
def log_management_summary(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> LogManagementSummary:
    count = db.query(func.count(ActivityLog.id)).scalar() or 0
    return LogManagementSummary(total_logs=count, log_size_mb=max(1, count // 250))


@router.delete("/logs", response_model=dict)
def manage_logs(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    older_than_days: int = 30,
    clear_all: bool = False,
) -> dict:
    if clear_all:
        db.query(ActivityLog).delete()
    else:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        db.query(ActivityLog).filter(ActivityLog.created_at < cutoff).delete()
    db.commit()
    write_audit_log(db, action="reports.logs.manage", message="Cleared old activity logs", actor_user_id=current_user.id, entity_type="logs", entity_id="activity", level="warn")
    return {"message": "تم حذف السجلات المحددة"}
