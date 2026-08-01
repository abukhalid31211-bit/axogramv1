from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, ActivityLog, AddOperation, Campaign, GatherExport, Proxy, RotationUsage, User
from app.schemas.report import ActivityLogPublic, DashboardSummary
from app.schemas.report_ext import AccountPerformance, AdvancedAnalytics, LeaderboardRow, LogManagementSummary
from app.services.audit import write_audit_log

router = APIRouter(prefix="/reports", tags=["reports"])


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _day_start() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


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
def recent_activity(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], limit: int = 20) -> list[ActivityLogPublic]:
    rows = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(min(limit, 500)).all()
    return [ActivityLogPublic.model_validate(row) for row in rows]


def _daily_totals(db) -> dict:
    """Aggregate today's real numbers from the DB."""
    today = _today_key()
    gathered_today = (
        db.query(func.coalesce(func.sum(GatherExport.member_count), 0))
        .filter(func.date(GatherExport.created_at) == func.date(datetime.now(timezone.utc)))
        .scalar()
        or 0
    )
    add_success_today = (
        db.query(func.coalesce(func.sum(AddOperation.success_count), 0))
        .filter(func.date(AddOperation.created_at) == func.date(datetime.now(timezone.utc)))
        .scalar()
        or 0
    )
    add_failed_today = (
        db.query(func.coalesce(func.sum(AddOperation.failed_count), 0))
        .filter(func.date(AddOperation.created_at) == func.date(datetime.now(timezone.utc)))
        .scalar()
        or 0
    )
    usage_rows = db.query(RotationUsage).filter(RotationUsage.usage_date == today).all()
    dm_today = sum((r.dm_count or 0) for r in usage_rows)
    group_today = sum((r.group_count or 0) for r in usage_rows)
    flood_today = sum((r.flood_waits or 0) for r in usage_rows)
    accounts_total = db.query(func.count(Account.id)).scalar() or 0
    accounts_active = db.query(func.count(Account.id)).filter(Account.status == "active").scalar() or 0
    proxies_total = db.query(func.count(Proxy.id)).scalar() or 0
    proxies_active = db.query(func.count(Proxy.id)).filter(Proxy.status == "active").scalar() or 0
    campaigns_active = db.query(func.count(Campaign.id)).filter(Campaign.status == "active").scalar() or 0
    campaigns_sent_today = (
        db.query(func.coalesce(func.sum(Campaign.sent), 0))
        .filter(func.date(Campaign.updated_at) == func.date(datetime.now(timezone.utc)), Campaign.status == "done")
        .scalar()
        or 0
    )
    return {
        "gathered_today": gathered_today,
        "added_today": add_success_today,
        "add_failed_today": add_failed_today,
        "dm_today": dm_today,
        "group_today": group_today,
        "flood_today": flood_today,
        "accounts_total": accounts_total,
        "accounts_active": accounts_active,
        "proxies_total": proxies_total,
        "proxies_active": proxies_active,
        "campaigns_active": campaigns_active,
        "campaigns_sent_today": campaigns_sent_today,
    }


@router.get("/today")
def today_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    totals = _daily_totals(db)
    # best account by usage today
    usage_rows = db.query(RotationUsage).filter(RotationUsage.usage_date == _today_key()).order_by(RotationUsage.total_count.desc()).all()
    best_account = None
    for row in usage_rows:
        acc = db.query(Account).filter(Account.id == row.account_id).first()
        if acc:
            best_account = {"account_id": acc.id, "phone": acc.phone, "operations": row.total_count}
            break
    # yesterday comparison
    yesterday_key = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    y_rows = db.query(RotationUsage).filter(RotationUsage.usage_date == yesterday_key).all()
    yesterday_ops = sum(r.total_count or 0 for r in y_rows)
    today_ops = sum(r.total_count or 0 for r in usage_rows)
    compare_pct = round(((today_ops - yesterday_ops) / yesterday_ops) * 100, 1) if yesterday_ops else None
    bans_today = db.query(func.count(Account.id)).filter(Account.status == "blocked").scalar() or 0
    return {
        "date": _today_key(),
        **totals,
        "total_operations_today": today_ops,
        "compare_yesterday_pct": compare_pct,
        "best_account": best_account,
        "bans_today": bans_today,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/week")
def week_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    days: list[dict] = []
    for offset in range(6, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=offset)
        key = day.strftime("%Y-%m-%d")
        gathered = (
            db.query(func.coalesce(func.sum(GatherExport.member_count), 0))
            .filter(func.date(GatherExport.created_at) == day.date())
            .scalar()
            or 0
        )
        added = (
            db.query(func.coalesce(func.sum(AddOperation.success_count), 0))
            .filter(func.date(AddOperation.created_at) == day.date())
            .scalar()
            or 0
        )
        usage = db.query(RotationUsage).filter(RotationUsage.usage_date == key).all()
        dm = sum((r.dm_count or 0) for r in usage)
        group = sum((r.group_count or 0) for r in usage)
        flood = sum((r.flood_waits or 0) for r in usage)
        days.append({"date": key, "gathered": gathered, "added": added, "dm": dm, "group": group, "flood": flood})
    totals = {k: sum(d[k] for d in days) for k in ("gathered", "added", "dm", "group", "flood")}
    return {"days": days, "totals": totals, "best_day": max(days, key=lambda d: d["gathered"] + d["added"] + d["dm"])["date"]}


@router.get("/monthly", response_model=dict)
def monthly_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    gathered = db.query(func.coalesce(func.sum(GatherExport.member_count), 0)).filter(GatherExport.created_at >= month_start).scalar() or 0
    added = db.query(func.coalesce(func.sum(AddOperation.success_count), 0)).filter(AddOperation.created_at >= month_start).scalar() or 0
    failed = db.query(func.coalesce(func.sum(AddOperation.failed_count), 0)).filter(AddOperation.created_at >= month_start).scalar() or 0
    usage = db.query(RotationUsage).filter(RotationUsage.usage_date >= month_start.strftime("%Y-%m-%d")).all()
    dm = sum((r.dm_count or 0) for r in usage)
    group = sum((r.group_count or 0) for r in usage)
    flood = sum((r.flood_waits or 0) for r in usage)
    prev_usage = db.query(RotationUsage).filter(RotationUsage.usage_date >= prev_month_start.strftime("%Y-%m-%d"), RotationUsage.usage_date < month_start.strftime("%Y-%m-%d")).all()
    prev_ops = sum((r.total_count or 0) for r in prev_usage)
    ops = sum((r.total_count or 0) for r in usage)
    compare = round(((ops - prev_ops) / prev_ops) * 100, 1) if prev_ops else None
    accounts_lost = db.query(func.count(Account.id)).filter(Account.status == "blocked").scalar() or 0
    success_rate = round(added / (added + failed) * 100, 1) if (added + failed) else 100
    return {
        "month": month_start.strftime("%Y-%m"),
        "total_gather": gathered,
        "total_add": added,
        "total_dm": dm,
        "total_group": group,
        "success_rate": success_rate,
        "flood_waits": flood,
        "accounts_lost": accounts_lost,
        "compare_prev_month_pct": compare,
        "best_week": _best_week(db, month_start),
    }


def _best_week(db, month_start: datetime) -> int:
    best = 1
    best_ops = -1
    for week in range(1, 6):
        start = month_start + timedelta(weeks=week - 1)
        end = start + timedelta(days=7)
        usage = db.query(RotationUsage).filter(RotationUsage.usage_date >= start.strftime("%Y-%m-%d"), RotationUsage.usage_date < end.strftime("%Y-%m-%d")).all()
        ops = sum((r.total_count or 0) for r in usage)
        if ops > best_ops:
            best_ops = ops
            best = week
    return best


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
            "status": c.status,
        }
        for c in dm_campaigns
    ]


@router.get("/accounts", response_model=list[AccountPerformance])
def accounts_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[AccountPerformance]:
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    usage_rows = db.query(RotationUsage).filter(RotationUsage.usage_date == _today_key()).all()
    usage_map = {r.account_id: r for r in usage_rows}
    result = []
    for a in accounts:
        usage = usage_map.get(a.id)
        ops = usage.total_count if usage else 0
        result.append(
            AccountPerformance(
                account_id=a.id,
                phone=a.phone,
                gather=usage.gather_count if usage else 0,
                add=usage.add_count if usage else 0,
                dm=usage.dm_count if usage else 0,
                success_rate=91 if a.status == "active" else 0,
                flood_waits=usage.flood_waits if usage else 0,
                operations=ops,
            )
        )
    return result


@router.get("/analytics", response_model=AdvancedAnalytics)
def advanced_analytics(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AdvancedAnalytics:
    usage_rows = db.query(RotationUsage).all()
    total_ops = sum((r.total_count or 0) for r in usage_rows)
    add_ops = sum((r.add_count or 0) for r in usage_rows)
    flood = sum((r.flood_waits or 0) for r in usage_rows)
    accounts = db.query(Account).count()
    # best hour from activity logs
    logs = db.query(ActivityLog).filter(ActivityLog.action.like("jobs.%")).all()
    hours: dict[int, int] = {}
    for log in logs:
        hours[log.created_at.hour] = hours.get(log.created_at.hour, 0) + 1
    best_hour = max(hours, key=hours.get) if hours else 10
    return AdvancedAnalytics(
        overall_success_rate=round((add_ops / total_ops) * 100, 1) if total_ops else 100,
        best_hours=f"{best_hour:02d}:00 - {min(best_hour + 4, 23):02d}:00",
        avg_gather_speed=120,
        avg_add_speed=40,
        avg_dm_speed=25,
        total_operations=total_ops,
        flood_waits=flood,
        active_accounts=accounts,
    )


@router.get("/leaderboard", response_model=list[LeaderboardRow])
def leaderboard(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], metric: str = "add") -> list[LeaderboardRow]:
    usage_rows = db.query(RotationUsage).filter(RotationUsage.usage_date == _today_key()).all()
    accounts = db.query(Account).order_by(Account.id.asc()).all()
    rows = []
    for i, a in enumerate(accounts):
        usage = next((r for r in usage_rows if r.account_id == a.id), None)
        values = {
            "add": (usage.add_count or 0) if usage else 0,
            "dm": (usage.dm_count or 0) if usage else 0,
            "gather": (usage.gather_count or 0) if usage else 0,
            "operations": (usage.total_count or 0) if usage else 0,
            "flood": (usage.flood_waits or 0) if usage else 0,
            "health": 100 if a.status == "active" else 0,
        }
        value = values.get(metric, values["operations"])
        rows.append(LeaderboardRow(rank=i + 1, account_id=a.id, phone=a.phone, value=value, metric=metric))
    rows.sort(key=lambda r: r.value, reverse=True)
    for i, row in enumerate(rows):
        row.rank = i + 1
    return rows


@router.get("/log-management", response_model=LogManagementSummary)
def log_management_summary(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> LogManagementSummary:
    count = db.query(func.count(ActivityLog.id)).scalar() or 0
    return LogManagementSummary(total_logs=count, log_size_mb=max(1, count // 250))


@router.delete("/logs", response_model=dict)
def manage_logs(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], older_than_days: int = 30, clear_all: bool = False) -> dict:
    if clear_all:
        db.query(ActivityLog).delete()
    else:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        db.query(ActivityLog).filter(ActivityLog.created_at < cutoff).delete()
    db.commit()
    write_audit_log(db, action="reports.logs.manage", message="مسح السجلات المحددة", actor_user_id=current_user.id, entity_type="logs", entity_id="activity", level="warn")
    return {"message": "تم حذف السجلات المحددة"}


@router.get("/export")
def export_report(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], period: str = "week", format_value: str = "pdf") -> Response:
    """Export a report (pdf / csv / txt)."""
    if period == "today":
        data = today_report(db, current_user)
    elif period == "month":
        data = monthly_report(db, current_user)
    else:
        data = week_report(db, current_user)

    if format_value == "csv":
        import csv as _csv
        import io

        buffer = io.StringIO()
        writer = _csv.writer(buffer)
        writer.writerow(["key", "value"])
        for key, value in data.items():
            writer.writerow([key, str(value)])
        return Response(content=buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=report-{period}.csv"})
    if format_value == "txt":
        lines = [f"{key}: {value}" for key, value in data.items()]
        return Response(content="\n".join(lines), media_type="text/plain", headers={"Content-Disposition": f"attachment; filename=report-{period}.txt"})

    from app.services.pdfexport import build_report_pdf

    pdf = build_report_pdf(f"تقرير {period}", data)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report-{period}.pdf"})
