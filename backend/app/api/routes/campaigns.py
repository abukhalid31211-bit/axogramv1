from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func

from app.api.deps import DbSession, check_run_quota, get_current_active_user, require_module
from app.db.models import Campaign, CampaignSchedule, MessageTemplate, User
from app.schemas.campaign import (
    CampaignCreate,
    CampaignPublic,
    CampaignReport,
    CampaignRetryPayload,
    CampaignScheduleCreate,
    CampaignSchedulePublic,
    CampaignStartPayload,
    CampaignStats,
    CampaignTestSendPayload,
    CampaignUpdate,
    MessageTemplateCreate,
    MessageTemplatePublic,
    MessageTemplateUpdate,
)
from app.schemas.common import MessageResponse
from app.schemas.jobs import JobStartResponse
from app.services import jobrunner
from app.services.subscription import MODULE_LABELS, is_platform_admin, module_allowed
from app.services.audit import write_audit_log

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _get_campaign(db, campaign_id: int, user: User) -> Campaign:
    row = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not row or (not is_platform_admin(user) and row.owner_user_id not in (None, user.id)):
        raise HTTPException(status_code=404, detail="الحملة غير موجودة")
    return row


def _kind_module(kind: str | None) -> str:
    return "massdm" if kind == "dm" else "campaigns"


def _require_kind_module(user: User, kind: str | None) -> None:
    module = _kind_module(kind)
    if not module_allowed(user, module):
        label = MODULE_LABELS.get(module, module)
        raise HTTPException(status_code=403, detail=f"🔒 هذه الوحدة غير مشمولة بباقتك — {label} — اطلب الترقية من الإدارة")


def _is_locked(db) -> None:
    from app.services.security import is_system_locked

    if is_system_locked(db):
        raise HTTPException(status_code=403, detail="النظام مقفل (وضع الطوارئ) — ألغِ القفل من أدوات الأمان أولاً")


@router.get("", response_model=list[CampaignPublic])
def list_campaigns(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    kind: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
) -> list[CampaignPublic]:
    query = db.query(Campaign)
    if not is_platform_admin(current_user):
        query = query.filter(Campaign.owner_user_id == current_user.id)
    if kind:
        query = query.filter(Campaign.kind == kind)
    if status_value:
        query = query.filter(Campaign.status == status_value)
    rows = query.order_by(Campaign.created_at.desc()).all()
    return [CampaignPublic.model_validate(row) for row in rows]


@router.post("", response_model=CampaignPublic, status_code=status.HTTP_201_CREATED)
def create_campaign(payload: CampaignCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignPublic:
    _require_kind_module(current_user, payload.kind)
    data = payload.model_dump()
    data.pop("created_at", None)
    row = Campaign(**data)
    row.owner_user_id = current_user.id
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.create", message=f"إنشاء حملة {row.name}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(row.id))
    return CampaignPublic.model_validate(row)


@router.get("/stats", response_model=CampaignStats)
def campaign_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignStats:
    if is_platform_admin(current_user):
        rows = db.query(Campaign).all()
    else:
        rows = db.query(Campaign).filter(Campaign.owner_user_id == current_user.id).all()
    return CampaignStats(
        total=len(rows),
        active=sum(1 for r in rows if r.status == "active"),
        paused=sum(1 for r in rows if r.status == "paused"),
        done=sum(1 for r in rows if r.status == "done"),
        drafts=sum(1 for r in rows if r.status == "draft"),
        dm=sum(1 for r in rows if r.kind == "dm"),
        group=sum(1 for r in rows if r.kind == "group"),
        total_sent=sum(r.sent for r in rows),
    )


# ---------- Execution ----------

@router.post("/{campaign_id}/start", response_model=JobStartResponse)
def start_campaign(campaign_id: int, payload: CampaignStartPayload | None, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    _is_locked(db)
    campaign = _get_campaign(db, campaign_id, current_user)
    _require_kind_module(current_user, campaign.kind)
    check_run_quota(db, current_user, "dm" if campaign.kind == "dm" else "group")
    if campaign.status == "active":
        raise HTTPException(status_code=409, detail="الحملة تعمل بالفعل")
    scheduled_at = (payload.scheduled_at if payload else None)
    if scheduled_at:
        # Create a schedule entry
        db.add(CampaignSchedule(campaign_id=campaign.id, campaign_name=campaign.name, kind=campaign.kind, pattern="one_time", next_run=scheduled_at, status="active"))
        db.commit()
        return JobStartResponse(mode="queued", message=f"تمت جدولة الحملة للتنفيذ في {scheduled_at.isoformat()}")
    kind = "dm_run" if campaign.kind == "dm" else "group_run"
    job_id = jobrunner.start_job(
        kind=kind,
        label=f"تشغيل حملة: {campaign.name}",
        entity_type="campaign",
        entity_id=str(campaign.id),
        actor_user_id=current_user.id,
        payload={"campaign_id": campaign.id, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت الحملة — يمكنك متابعة التقدم مباشرة", job_id=job_id)


@router.post("/{campaign_id}/pause", response_model=MessageResponse)
def pause_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    campaign = _get_campaign(db, campaign_id, current_user)
    run = (
        db.query(jobrunner.JobRun)
        .filter(jobrunner.JobRun.entity_type == "campaign", jobrunner.JobRun.entity_id == str(campaign_id), jobrunner.JobRun.status.in_(["queued", "running"]))
        .order_by(jobrunner.JobRun.created_at.desc())
        .first()
    )
    if run:
        jobrunner.set_control(run.id, "pause")
        campaign.status = "paused"
        db.add(campaign)
        db.commit()
        return MessageResponse(message="تم إيقاف الحملة مؤقتاً — ستستأنف من نفس النقطة")
    raise HTTPException(status_code=409, detail="لا توجد عملية تشغيل نشطة للحملة")


@router.post("/{campaign_id}/resume", response_model=JobStartResponse)
def resume_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    campaign = _get_campaign(db, campaign_id, current_user)
    _require_kind_module(current_user, campaign.kind)
    run = (
        db.query(jobrunner.JobRun)
        .filter(jobrunner.JobRun.entity_type == "campaign", jobrunner.JobRun.entity_id == str(campaign_id), jobrunner.JobRun.status == "paused")
        .order_by(jobrunner.JobRun.created_at.desc())
        .first()
    )
    if run:
        jobrunner.set_control(run.id, "run")
        campaign.status = "active"
        db.add(campaign)
        db.commit()
        return JobStartResponse(mode="queued", message="تم استئناف الحملة", job_id=run.id)
    # No paused run — start fresh from saved progress
    kind = "dm_run" if campaign.kind == "dm" else "group_run"
    job_id = jobrunner.start_job(
        kind=kind,
        label=f"استئناف حملة: {campaign.name}",
        entity_type="campaign",
        entity_id=str(campaign.id),
        actor_user_id=current_user.id,
        payload={"campaign_id": campaign.id, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم تشغيل الحملة من جديد", job_id=job_id)


@router.post("/{campaign_id}/stop", response_model=MessageResponse)
def stop_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    campaign = _get_campaign(db, campaign_id, current_user)
    runs = (
        db.query(jobrunner.JobRun)
        .filter(jobrunner.JobRun.entity_type == "campaign", jobrunner.JobRun.entity_id == str(campaign_id), jobrunner.JobRun.status.in_(["queued", "running", "paused"]))
        .all()
    )
    for run in runs:
        jobrunner.set_control(run.id, "cancel")
    campaign.status = "draft" if campaign.progress == 0 else "paused"
    db.add(campaign)
    db.commit()
    return MessageResponse(message="تم إيقاف الحملة وحفظ تقدمها")


@router.post("/{campaign_id}/retry-failed", response_model=JobStartResponse)
def retry_failed(campaign_id: int, payload: CampaignRetryPayload | None, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    _is_locked(db)
    campaign = _get_campaign(db, campaign_id, current_user)
    _require_kind_module(current_user, campaign.kind)
    check_run_quota(db, current_user, "dm" if campaign.kind == "dm" else "group")
    failed_items = payload.failed_items if payload else []
    job_id = jobrunner.start_job(
        kind="campaign_retry",
        label=f"إعادة إرسال الفاشلة: {campaign.name}",
        entity_type="campaign",
        entity_id=str(campaign.id),
        actor_user_id=current_user.id,
        payload={"campaign_id": campaign.id, "failed_only": failed_items, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="بدأت إعادة إرسال العناصر الفاشلة", job_id=job_id)


@router.get("/{campaign_id}/report", response_model=CampaignReport)
def campaign_report(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignReport:
    campaign = _get_campaign(db, campaign_id, current_user)
    run = (
        db.query(jobrunner.JobRun)
        .filter(
            jobrunner.JobRun.entity_type == "campaign",
            jobrunner.JobRun.entity_id == str(campaign_id),
            jobrunner.JobRun.status == "done",
        )
        .order_by(jobrunner.JobRun.created_at.desc())
        .first()
    )
    if not run or not run.result_json:
        raise HTTPException(status_code=404, detail="لا يوجد تقرير نهائي للحملة بعد")
    import json as _json

    data = _json.loads(run.result_json)
    return CampaignReport(**{k: data.get(k) for k in CampaignReport.model_fields.keys()})


@router.get("/{campaign_id}/report.pdf")
def campaign_report_pdf(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> Response:
    from app.services.pdfexport import build_campaign_report_pdf

    campaign = _get_campaign(db, campaign_id, current_user)
    run = (
        db.query(jobrunner.JobRun)
        .filter(jobrunner.JobRun.entity_type == "campaign", jobrunner.JobRun.entity_id == str(campaign_id), jobrunner.JobRun.status == "done")
        .order_by(jobrunner.JobRun.created_at.desc())
        .first()
    )
    if not run or not run.result_json:
        raise HTTPException(status_code=404, detail="لا يوجد تقرير نهائي للحملة بعد")
    import json as _json

    data = _json.loads(run.result_json)
    pdf = build_campaign_report_pdf(campaign, data)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="campaign-{campaign.id}-report.pdf"'})


@router.get("/{campaign_id}/progress")
def campaign_progress(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    campaign = _get_campaign(db, campaign_id, current_user)
    run = (
        db.query(jobrunner.JobRun)
        .filter(jobrunner.JobRun.entity_type == "campaign", jobrunner.JobRun.entity_id == str(campaign_id))
        .order_by(jobrunner.JobRun.created_at.desc())
        .first()
    )
    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "progress": campaign.progress,
        "sent": campaign.sent,
        "total": campaign.total,
        "last_error": campaign.last_error,
        "job_status": run.status if run else None,
        "job_current_step": run.current_step if run else None,
        "job_id": run.id if run else None,
        "started_at": campaign.started_at.isoformat() if campaign.started_at else None,
        "finished_at": campaign.finished_at.isoformat() if campaign.finished_at else None,
    }


@router.post("/{campaign_id}/test-send", response_model=MessageResponse)
def test_send(campaign_id: int, payload: CampaignTestSendPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    campaign = _get_campaign(db, campaign_id, current_user)
    _require_kind_module(current_user, campaign.kind)
    if not payload.target:
        raise HTTPException(status_code=400, detail="حدد الهدف (Saved Messages = me / @username / معرف)")
    from app.db.models import Account
    from app.services.settings import get_telegram_credentials
    from app.services.telegram import build_client_for_account, make_variables, parse_username, render_message

    try:
        api_id, api_hash = get_telegram_credentials(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="اضبط Telegram API ID و API Hash أولاً") from exc
    account = None
    if payload.account_id:
        account = db.query(Account).filter(Account.id == payload.account_id).first()
    if not account:
        from app.services.rotation import pick_accounts

        from app.services.subscription import owner_scope_for

        picked = pick_accounts(db, campaign.kind, count=1, owner_user_id=owner_scope_for(db, current_user.id))
        account = picked[0] if picked else None
    if not account or not account.session_file_path:
        raise HTTPException(status_code=400, detail="لا يوجد حساب بجلسة متاحة للإرسال التجريبي")

    import asyncio

    message = payload.message or campaign.message_text or "رسالة تجريبية"
    variables = make_variables(first_name="أحمد", username="@test_user")
    rendered = render_message(message, variables)

    async def _send():
        client = build_client_for_account(db, account, api_id, api_hash)
        await client.connect()
        try:
            await client.send_message(parse_username(payload.target), rendered)
        finally:
            await client.disconnect()

    try:
        asyncio.run(_send())
        return MessageResponse(message="✅ تم إرسال الرسالة التجريبية بنجاح")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"فشل الإرسال التجريبي: {exc}") from exc


# ---------- Templates ----------

@router.get("/templates", response_model=list[MessageTemplatePublic])
def list_templates(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    kind: str | None = Query(default=None),
) -> list[MessageTemplatePublic]:
    query = db.query(MessageTemplate)
    if kind:
        query = query.filter(MessageTemplate.kind == kind)
    rows = query.order_by(MessageTemplate.created_at.desc()).all()
    return [MessageTemplatePublic.model_validate(row) for row in rows]


@router.post("/templates", response_model=MessageTemplatePublic, status_code=status.HTTP_201_CREATED)
def create_template(payload: MessageTemplateCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageTemplatePublic:
    _require_kind_module(current_user, payload.kind)
    row = MessageTemplate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return MessageTemplatePublic.model_validate(row)


@router.put("/templates/{template_id}", response_model=MessageTemplatePublic)
def update_template(template_id: int, payload: MessageTemplateUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageTemplatePublic:
    row = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القالب غير موجود")
    _require_kind_module(current_user, payload.kind if payload.kind is not None else row.kind)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return MessageTemplatePublic.model_validate(row)


@router.delete("/templates/{template_id}", response_model=MessageResponse)
def delete_template(template_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القالب غير موجود")
    db.delete(row)
    db.commit()
    return MessageResponse(message="تم حذف القالب")


# ---------- Schedules ----------

@router.get("/schedules", response_model=list[CampaignSchedulePublic])
def list_schedules(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[CampaignSchedulePublic]:
    rows = db.query(CampaignSchedule).order_by(CampaignSchedule.created_at.desc()).all()
    return [CampaignSchedulePublic.model_validate(row) for row in rows]


@router.post("/schedules", response_model=CampaignSchedulePublic, status_code=status.HTTP_201_CREATED)
def create_schedule(payload: CampaignScheduleCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignSchedulePublic:
    _require_kind_module(current_user, payload.kind)
    row = CampaignSchedule(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.schedule.create", message=f"جدولة حملة {row.campaign_name} ({row.pattern})", actor_user_id=current_user.id, entity_type="schedule", entity_id=str(row.id))
    return CampaignSchedulePublic.model_validate(row)


@router.post("/schedules/{schedule_id}/toggle", response_model=CampaignSchedulePublic)
def toggle_schedule(schedule_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignSchedulePublic:
    row = db.query(CampaignSchedule).filter(CampaignSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الجدولة غير موجودة")
    row.status = "paused" if row.status == "active" else "active"
    db.add(row)
    db.commit()
    db.refresh(row)
    return CampaignSchedulePublic.model_validate(row)


@router.delete("/schedules/{schedule_id}", response_model=MessageResponse)
def delete_schedule(schedule_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(CampaignSchedule).filter(CampaignSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الجدولة غير موجودة")
    db.delete(row)
    db.commit()
    return MessageResponse(message="تم حذف الجدولة")


# ---------- Parametrized (must come last) ----------

@router.get("/{campaign_id}", response_model=CampaignPublic)
def get_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignPublic:
    return CampaignPublic.model_validate(_get_campaign(db, campaign_id, current_user))


@router.put("/{campaign_id}", response_model=CampaignPublic)
def update_campaign(campaign_id: int, payload: CampaignUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignPublic:
    row = _get_campaign(db, campaign_id, current_user)
    data = payload.model_dump(exclude_unset=True)
    _require_kind_module(current_user, data.get("kind", row.kind))
    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return CampaignPublic.model_validate(row)


@router.post("/{campaign_id}/toggle", response_model=CampaignPublic)
def toggle_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignPublic:
    row = _get_campaign(db, campaign_id, current_user)
    row.status = "paused" if row.status == "active" else "active"
    db.add(row)
    db.commit()
    db.refresh(row)
    return CampaignPublic.model_validate(row)


@router.delete("/{campaign_id}", response_model=MessageResponse)
def delete_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = _get_campaign(db, campaign_id, current_user)
    name = row.name
    db.delete(row)
    db.commit()
    write_audit_log(db, action="campaigns.delete", message=f"حذف حملة {name}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(campaign_id), level="warn")
    return MessageResponse(message="تم حذف الحملة")
