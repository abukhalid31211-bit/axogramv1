from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Account, User
from app.schemas.account import AccountCreate, AccountPublic, AccountUpdate
from app.schemas.common import MessageResponse
from app.services.audit import write_audit_log

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountPublic])
def list_accounts(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    search: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
) -> list[AccountPublic]:
    query = db.query(Account)
    if search:
        query = query.filter(Account.name.ilike(f"%{search}%") | Account.phone.ilike(f"%{search}%") | Account.username.ilike(f"%{search}%"))
    if status_value:
        query = query.filter(Account.status == status_value)
    rows = query.order_by(Account.id.asc()).all()
    return [AccountPublic.model_validate(row) for row in rows]


@router.post("", response_model=AccountPublic, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AccountPublic:
    if db.query(Account).filter(Account.phone == payload.phone).first():
        raise HTTPException(status_code=409, detail="رقم الهاتف موجود مسبقاً")
    row = Account(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.create", message=f"Created account {row.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(row.id))
    return AccountPublic.model_validate(row)


@router.get("/{account_id}", response_model=AccountPublic)
def get_account(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    row = db.query(Account).filter(Account.id == account_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    return AccountPublic.model_validate(row)


@router.put("/{account_id}", response_model=AccountPublic)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AccountPublic:
    row = db.query(Account).filter(Account.id == account_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.update", message=f"Updated account {row.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(row.id))
    return AccountPublic.model_validate(row)


@router.delete("/{account_id}", response_model=MessageResponse)
def delete_account(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(Account).filter(Account.id == account_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    phone = row.phone
    db.delete(row)
    db.commit()
    write_audit_log(db, action="accounts.delete", message=f"Deleted account {phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id), level="warn")
    return MessageResponse(message="تم حذف الحساب")
