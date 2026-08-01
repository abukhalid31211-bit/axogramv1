from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response

from app.api.deps import DbSession, get_current_active_user
from app.db.models import GroupBlacklist, GroupCategory, TargetGroup, User
from app.schemas.common import MessageResponse
from app.schemas.group import (
    GroupBlacklistCreate,
    GroupBlacklistEntryPublic,
    GroupCategoryCreate,
    GroupCategoryPublic,
    GroupCategoryUpdate,
    GroupStats,
    GroupsJoinPayload,
    GroupsLeavePayload,
    TargetGroupCreate,
    TargetGroupPublic,
    TargetGroupUpdate,
)
from app.schemas.jobs import JobStartResponse
from app.services import jobrunner
from app.services.audit import write_audit_log

router = APIRouter(prefix="/groups", tags=["groups"])


# ==========================================================================
# Categories
# ==========================================================================

@router.get("/categories", response_model=list[GroupCategoryPublic])
def list_categories(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[GroupCategoryPublic]:
    rows = db.query(GroupCategory).order_by(GroupCategory.name.asc()).all()
    result = []
    for row in rows:
        count = db.query(TargetGroup).filter(TargetGroup.category_id == row.id).count()
        result.append(GroupCategoryPublic(id=row.id, name=row.name, description=row.description, groups_count=count, created_at=row.created_at))
    return result


@router.post("/categories", response_model=GroupCategoryPublic, status_code=status.HTTP_201_CREATED)
def create_category(payload: GroupCategoryCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GroupCategoryPublic:
    if db.query(GroupCategory).filter(GroupCategory.name == payload.name).first():
        raise HTTPException(status_code=409, detail="التصنيف موجود مسبقاً")
    row = GroupCategory(name=payload.name, description=payload.description)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="groups.categories.create", message=f"إنشاء تصنيف {row.name}", actor_user_id=current_user.id, entity_type="group_category", entity_id=str(row.id))
    return GroupCategoryPublic(id=row.id, name=row.name, description=row.description, groups_count=0, created_at=row.created_at)


@router.put("/categories/{category_id}", response_model=GroupCategoryPublic)
def update_category(category_id: int, payload: GroupCategoryUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GroupCategoryPublic:
    row = db.query(GroupCategory).filter(GroupCategory.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    count = db.query(TargetGroup).filter(TargetGroup.category_id == row.id).count()
    return GroupCategoryPublic(id=row.id, name=row.name, description=row.description, groups_count=count, created_at=row.created_at)


@router.delete("/categories/{category_id}", response_model=MessageResponse)
def delete_category(category_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(GroupCategory).filter(GroupCategory.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="التصنيف غير موجود")
    db.query(TargetGroup).filter(TargetGroup.category_id == category_id).update({TargetGroup.category_id: None})
    db.delete(row)
    db.commit()
    return MessageResponse(message="تم حذف التصنيف")


@router.post("/categorize", response_model=dict)
def auto_categorize(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    """Auto-categorize groups by keyword matching on their names."""
    keywords = {
        "تسويق": ["market", "marketing", "تسويق", "بيع", "offers", "deal"],
        "تداول": ["trade", "trading", "تداول", "forex", "crypto", "عملات", "stocks", "اسهم"],
        "عروض": ["offers", "discount", "خصم", "عروض", "coupon", "كوبون"],
        "تعليم": ["edu", "learn", "تعليم", "دورات", "courses", "study", "دراسة"],
        "تقنية": ["tech", "تقنية", "برمجة", "coding", "programming", "ai", "ذكاء"],
        "عام": [],
    }
    categorized = 0
    for group in db.query(TargetGroup).all():
        name = group.name.lower()
        matched = "عام"
        for category_name, words in keywords.items():
            if any(word in name for word in words):
                matched = category_name
                break
        category = db.query(GroupCategory).filter(GroupCategory.name == matched).first()
        if not category:
            category = GroupCategory(name=matched)
            db.add(category)
            db.commit()
            db.refresh(category)
        if group.category_id != category.id:
            group.category_id = category.id
            db.add(group)
            categorized += 1
    db.commit()
    write_audit_log(db, action="groups.categorize.auto", message=f"تصنيف تلقائي: تم تصنيف {categorized} قروب", actor_user_id=current_user.id, entity_type="group", entity_id="auto")
    return {"categorized": categorized}


# ==========================================================================
# Blacklist
# ==========================================================================

@router.get("/blacklist", response_model=list[GroupBlacklistEntryPublic])
def list_group_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[GroupBlacklistEntryPublic]:
    rows = db.query(GroupBlacklist).order_by(GroupBlacklist.created_at.desc()).all()
    return [GroupBlacklistEntryPublic.model_validate(row) for row in rows]


@router.post("/blacklist", response_model=GroupBlacklistEntryPublic, status_code=status.HTTP_201_CREATED)
def add_group_blacklist(payload: GroupBlacklistCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GroupBlacklistEntryPublic:
    value = payload.group_value.strip().lstrip("@")
    existing = db.query(GroupBlacklist).filter(GroupBlacklist.group_value == value).first()
    if existing:
        raise HTTPException(status_code=409, detail="القروب موجود في القائمة السوداء")
    row = GroupBlacklist(group_value=value, reason=payload.reason, created_by=current_user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return GroupBlacklistEntryPublic.model_validate(row)


@router.delete("/blacklist/{entry_id}", response_model=MessageResponse)
def remove_group_blacklist(entry_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(GroupBlacklist).filter(GroupBlacklist.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="غير موجود")
    db.delete(row)
    db.commit()
    return MessageResponse(message="تمت الإزالة")


@router.delete("/blacklist", response_model=MessageResponse)
def clear_group_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    db.query(GroupBlacklist).delete()
    db.commit()
    return MessageResponse(message="تم مسح القائمة السوداء")


@router.get("/blacklist/export")
def export_group_blacklist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> Response:
    rows = db.query(GroupBlacklist).all()
    content = "group,reason,created_at\n" + "\n".join([f"{r.group_value},{r.reason or ''},{r.created_at.isoformat()}" for r in rows])
    return Response(content=content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=group-blacklist.csv"})


# ==========================================================================
# Groups
# ==========================================================================

@router.get("", response_model=list[TargetGroupPublic])
def list_groups(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    search: str | None = None,
    category_id: int | None = None,
    group_type: str | None = None,
    status_value: str | None = None,
) -> list[TargetGroupPublic]:
    query = db.query(TargetGroup)
    if search:
        query = query.filter(TargetGroup.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(TargetGroup.category_id == category_id)
    if group_type:
        query = query.filter(TargetGroup.group_type == group_type)
    if status_value:
        query = query.filter(TargetGroup.status == status_value)
    rows = query.order_by(TargetGroup.members_count.desc()).all()
    result = []
    for row in rows:
        category_name = None
        if row.category_id:
            cat = db.query(GroupCategory).filter(GroupCategory.id == row.category_id).first()
            category_name = cat.name if cat else None
        account_phone = None
        if row.account_id:
            acc = db.query(__import__("app.db.models", fromlist=["Account"]).Account).filter(__import__("app.db.models", fromlist=["Account"]).Account.id == row.account_id).first()
            account_phone = acc.phone if acc else None
        item = TargetGroupPublic.model_validate(row)
        item.category_name = category_name
        item.account_phone = account_phone
        result.append(item)
    return result


@router.post("", response_model=TargetGroupPublic, status_code=status.HTTP_201_CREATED)
def create_group(payload: TargetGroupCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> TargetGroupPublic:
    if db.query(TargetGroup).filter(TargetGroup.name == payload.name).first():
        raise HTTPException(status_code=409, detail="القروب موجود مسبقاً")
    row = TargetGroup(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="groups.create", message=f"إضافة قروب {row.name}", actor_user_id=current_user.id, entity_type="group", entity_id=str(row.id))
    return TargetGroupPublic.model_validate(row)


@router.post("/join", response_model=JobStartResponse)
def join_groups(payload: GroupsJoinPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    links = [link.strip() for link in payload.links if link.strip()]
    if not links:
        raise HTTPException(status_code=400, detail="أدخل رابطاً واحداً على الأقل")
    job_id = jobrunner.start_job(
        kind="groups_join",
        label=f"الانضمام إلى {len(links)} قروب",
        entity_type="group",
        entity_id="join",
        actor_user_id=current_user.id,
        payload={"links": links, "account_ids": payload.account_ids, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء الانضمام للقروبات", job_id=job_id)


@router.post("/leave", response_model=JobStartResponse)
def leave_groups(payload: GroupsLeavePayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="groups_leave",
        label="مغادرة قروبات",
        entity_type="group",
        entity_id="leave",
        actor_user_id=current_user.id,
        payload={"group_ids": payload.group_ids, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء المغادرة", job_id=job_id)


@router.post("/refresh", response_model=JobStartResponse)
def refresh_groups(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="groups_refresh",
        label="تحديث معلومات القروبات",
        entity_type="group",
        entity_id="refresh",
        actor_user_id=current_user.id,
        payload={"actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء تحديث معلومات القروبات", job_id=job_id)


@router.get("/stats", response_model=GroupStats)
def group_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> GroupStats:
    from sqlalchemy import func
    from datetime import datetime, timezone, timedelta

    rows = db.query(TargetGroup).all()
    total_members = sum(g.members_count or 0 for g in rows)
    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for g in rows:
        by_type[g.group_type or "public"] = by_type.get(g.group_type or "public", 0) + 1
        by_status[g.status or "active"] = by_status.get(g.status or "active", 0) + 1
        if g.category_id:
            cat = db.query(GroupCategory).filter(GroupCategory.id == g.category_id).first()
            name = cat.name if cat else "غير مصنف"
            by_category[name] = by_category.get(name, 0) + 1
        else:
            by_category["غير مصنف"] = by_category.get("غير مصنف", 0) + 1
    largest = sorted([{"name": g.name, "members": g.members_count or 0} for g in rows], key=lambda x: x["members"], reverse=True)[:10]
    joined_today = db.query(TargetGroup).filter(TargetGroup.created_at >= datetime.now(timezone.utc) - timedelta(days=1)).count()
    return GroupStats(
        total_groups=len(rows),
        total_members=total_members,
        by_type=by_type,
        by_status=by_status,
        by_category=by_category,
        largest=largest,
        joined_today=joined_today,
    )


@router.get("/export")
def export_groups(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], format_value: str = "txt") -> Response:
    rows = db.query(TargetGroup).order_by(TargetGroup.name.asc()).all()
    if format_value == "csv":
        content = "name,type,members,status,category\n" + "\n".join(
            [
                f"{g.name},{g.group_type or 'public'},{g.members_count or 0},{g.status or 'active'},"
                + (db.query(GroupCategory).filter(GroupCategory.id == g.category_id).first().name if g.category_id and db.query(GroupCategory).filter(GroupCategory.id == g.category_id).first() else "")
                for g in rows
            ]
        )
        return Response(content=content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=groups.csv"})
    content = "\n".join([g.name for g in rows])
    return Response(content=content, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=groups.txt"})


@router.post("/import")
async def import_groups(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], file: UploadFile = File(...)) -> dict:
    content = (await file.read()).decode("utf-8", errors="replace")
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    imported = skipped = 0
    for line in lines:
        name = line.split(",")[0].strip() if "," in line else line.strip()
        if not name:
            continue
        if db.query(TargetGroup).filter(TargetGroup.name == name).first():
            skipped += 1
            continue
        db.add(TargetGroup(name=name, status="active"))
        imported += 1
    db.commit()
    write_audit_log(db, action="groups.import", message=f"استيراد قروبات: {imported} مستورد | {skipped} مكرر", actor_user_id=current_user.id, entity_type="group", entity_id="import")
    return {"imported": imported, "skipped": skipped, "total": len(lines)}


@router.get("/{group_id}", response_model=TargetGroupPublic)
def get_group(group_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> TargetGroupPublic:
    row = db.query(TargetGroup).filter(TargetGroup.id == group_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القروب غير موجود")
    return TargetGroupPublic.model_validate(row)


@router.put("/{group_id}", response_model=TargetGroupPublic)
def update_group(group_id: int, payload: TargetGroupUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> TargetGroupPublic:
    row = db.query(TargetGroup).filter(TargetGroup.id == group_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القروب غير موجود")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return TargetGroupPublic.model_validate(row)


@router.delete("/{group_id}", response_model=MessageResponse)
def delete_group(group_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(TargetGroup).filter(TargetGroup.id == group_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="القروب غير موجود")
    db.delete(row)
    db.commit()
    return MessageResponse(message="تم حذف القروب")
