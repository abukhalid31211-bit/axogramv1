from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func

from app.api.deps import DbSession, get_current_active_user
from app.db.models import (
    Campaign,
    CampaignSchedule,
    MessageTemplate,
    User,
)
from app.schemas.campaign import (
    CampaignCreate,
    CampaignPublic,
    CampaignScheduleCreate,
    CampaignSchedulePublic,
    CampaignStats,
    CampaignUpdate,
    MessageTemplateCreate,
    MessageTemplatePublic,
    MessageTemplateUpdate,
)
from app.schemas.common import MessageResponse
from app.services.audit import write_audit_log

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[CampaignPublic])
def list_campaigns(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    kind: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
) -> list[CampaignPublic]:
    query = db.query(Campaign)
    if kind:
        query = query.filter(Campaign.kind == kind)
    if status_value:
        query = query.filter(Campaign.status == status_value)
    rows = query.order_by(Campaign.created_at.desc()).all()
    return [CampaignPublic.model_validate(row) for row in rows]


@router.post("", response_model=CampaignPublic, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CampaignPublic:
    row = Campaign(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.create", message=f"Created campaign {row.name}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(row.id))
    return CampaignPublic.model_validate(row)


@router.get("/stats", response_model=CampaignStats)
def campaign_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignStats:
    rows = db.query(Campaign).all()
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
def create_template(
    payload: MessageTemplateCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageTemplatePublic:
    row = MessageTemplate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.template.create", message=f"Created template {row.name}", actor_user_id=current_user.id, entity_type="template", entity_id=str(row.id))
    return MessageTemplatePublic.model_validate(row)


@router.put("/templates/{template_id}", response_model=MessageTemplatePublic)
def update_template(
    template_id: int,
    payload: MessageTemplateUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MessageTemplatePublic:
    row = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القالب غير موجود")
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
def create_schedule(
    payload: CampaignScheduleCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CampaignSchedulePublic:
    row = CampaignSchedule(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.schedule.create", message=f"Scheduled campaign {row.campaign_name}", actor_user_id=current_user.id, entity_type="schedule", entity_id=str(row.id))
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


@router.get("/{campaign_id}", response_model=CampaignPublic)
def get_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> CampaignPublic:
    row = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحملة غير موجودة")
    return CampaignPublic.model_validate(row)


@router.put("/{campaign_id}", response_model=CampaignPublic)
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CampaignPublic:
    row = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحملة غير موجودة")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.update", message=f"Updated campaign {row.name}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(row.id))
    return CampaignPublic.model_validate(row)


@router.post("/{campaign_id}/toggle", response_model=CampaignPublic)
def toggle_campaign(
    campaign_id: int,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> CampaignPublic:
    row = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحملة غير موجودة")
    if row.status in ("active", "running"):
        row.status = "paused"
    else:
        row.status = "active"
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="campaigns.toggle", message=f"Toggled campaign {row.name} to {row.status}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(row.id))
    return CampaignPublic.model_validate(row)


@router.delete("/{campaign_id}", response_model=MessageResponse)
def delete_campaign(campaign_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحملة غير موجودة")
    db.delete(row)
    db.commit()
    write_audit_log(db, action="campaigns.delete", message=f"Deleted campaign {campaign_id}", actor_user_id=current_user.id, entity_type="campaign", entity_id=str(campaign_id), level="warn")
    return MessageResponse(message="تم حذف الحملة")


# ---------- Message Templates ----------
