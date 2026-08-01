import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DbSession, get_current_active_user, require_admin
from app.core.security import get_password_hash
from app.db.models import User
from app.schemas.auth import UserNotices, UserPublic, UserCreate, UserUpdate
from app.services.audit import write_audit_log
from app.services.settings import get_setting_value
from app.services.subscription import (
    is_platform_admin,
    remaining_label,
    remaining_seconds,
    subscription_status,
    to_user_public,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def read_me(current_user: Annotated[User, Depends(get_current_active_user)]) -> UserPublic:
    return to_user_public(current_user)


@router.get("/me/notices", response_model=UserNotices)
def read_my_notices(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> UserNotices:
    broadcast = None
    raw = get_setting_value(db, "broadcast_message")
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("message"):
                # Only show reasonably fresh broadcasts (last 7 days are kept client-side too)
                broadcast = {
                    "title": data.get("title") or "تنبيه من الإدارة",
                    "message": data.get("message"),
                    "sent_at": data.get("sent_at"),
                }
        except Exception:
            broadcast = None
    return UserNotices(
        subscription_status=subscription_status(current_user),
        remaining_seconds=remaining_seconds(current_user),
        remaining_label=remaining_label(current_user),
        expires_at=current_user.expires_at,
        broadcast=broadcast,
    )


@router.get("", response_model=list[UserPublic])
def list_users(db: DbSession, admin: Annotated[User, Depends(require_admin)]) -> list[UserPublic]:
    rows = db.query(User).order_by(User.created_at.desc()).all()
    return [to_user_public(row) for row in rows]


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, admin: Annotated[User, Depends(require_admin)]) -> UserPublic:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="اسم المستخدم موجود مسبقاً")
    row = User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role or "user",
        is_active=payload.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="users.create", message=f"Created user {row.username}", actor_user_id=admin.id, entity_type="user", entity_id=str(row.id))
    return to_user_public(row)


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, db: DbSession, admin: Annotated[User, Depends(require_admin)]) -> UserPublic:
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return to_user_public(row)


@router.put("/{user_id}", response_model=UserPublic)
def update_user(user_id: int, payload: UserUpdate, db: DbSession, admin: Annotated[User, Depends(require_admin)]) -> UserPublic:
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if is_platform_admin(row):
        # The permanent admin may only be edited from the server side.
        data = payload.model_dump(exclude_unset=True)
        allowed = {"full_name"}
        if not set(data.keys()) <= allowed:
            raise HTTPException(status_code=403, detail="لا يمكن تعديل حساب المدير الدائم من هنا — يُدار من الخادم فقط")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        data["hashed_password"] = get_password_hash(data.pop("password"))
    else:
        data.pop("password", None)
    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="users.update", message=f"Updated user {row.username}", actor_user_id=admin.id, entity_type="user", entity_id=str(row.id))
    return to_user_public(row)


@router.delete("/{user_id}", response_model=dict)
def delete_user(user_id: int, db: DbSession, admin: Annotated[User, Depends(require_admin)]) -> dict:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="لا يمكن حذف حسابك الحالي")
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if is_platform_admin(row):
        raise HTTPException(status_code=403, detail="لا يمكن حذف المدير الدائم للنظام")
    db.delete(row)
    db.commit()
    write_audit_log(db, action="users.delete", message=f"Deleted user {user_id}", actor_user_id=admin.id, entity_type="user", entity_id=str(user_id), level="warn")
    return {"message": "تم حذف المستخدم"}
