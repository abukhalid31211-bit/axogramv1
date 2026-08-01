from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DbSession, get_current_active_user
from app.db.models import Proxy, User
from app.schemas.common import MessageResponse
from app.schemas.proxy import ProxyCreate, ProxyPublic, ProxyUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/proxies", tags=["proxies"])


@router.get("", response_model=list[ProxyPublic])
def list_proxies(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    search: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
) -> list[ProxyPublic]:
    query = db.query(Proxy)
    if search:
        query = query.filter(Proxy.address.ilike(f"%{search}%"))
    if status_value:
        query = query.filter(Proxy.status == status_value)
    rows = query.order_by(Proxy.id.asc()).all()
    return [ProxyPublic.model_validate(row) for row in rows]


@router.post("", response_model=ProxyPublic, status_code=status.HTTP_201_CREATED)
def create_proxy(payload: ProxyCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPublic:
    if db.query(Proxy).filter(Proxy.address == payload.address).first():
        raise HTTPException(status_code=409, detail="البروكسي موجود مسبقاً")
    row = Proxy(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="proxies.create", message=f"Created proxy {row.address}", actor_user_id=current_user.id, entity_type="proxy", entity_id=str(row.id))
    return ProxyPublic.model_validate(row)


@router.get("/{proxy_id}", response_model=ProxyPublic)
def get_proxy(proxy_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPublic:
    row = db.query(Proxy).filter(Proxy.id == proxy_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="البروكسي غير موجود")
    return ProxyPublic.model_validate(row)


@router.put("/{proxy_id}", response_model=ProxyPublic)
def update_proxy(proxy_id: int, payload: ProxyUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPublic:
    row = db.query(Proxy).filter(Proxy.id == proxy_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="البروكسي غير موجود")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="proxies.update", message=f"Updated proxy {row.address}", actor_user_id=current_user.id, entity_type="proxy", entity_id=str(row.id))
    return ProxyPublic.model_validate(row)


@router.delete("/{proxy_id}", response_model=MessageResponse)
def delete_proxy(proxy_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(Proxy).filter(Proxy.id == proxy_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="البروكسي غير موجود")
    address = row.address
    db.delete(row)
    db.commit()
    write_audit_log(db, action="proxies.delete", message=f"Deleted proxy {address}", actor_user_id=current_user.id, entity_type="proxy", entity_id=str(proxy_id), level="warn")
    return MessageResponse(message="تم حذف البروكسي")
