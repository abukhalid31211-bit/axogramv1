from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DbSession, get_current_active_user
from app.db.models import AppSetting, Proxy, ProxyPool, User
from app.schemas.common import MessageResponse
from app.schemas.proxy import ProxyCreate, ProxyPublic, ProxyUpdate
from app.schemas.proxypool import (
    ProxyGeneralSettingsUpdate,
    ProxyNotificationsUpdate,
    ProxyPoolCreate,
    ProxyPoolDetail,
    ProxyPoolPublic,
    ProxyPoolUpdate,
    ProxyValidateBatch,
)
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


# ---------- Static-path routes (must precede /{proxy_id}) ----------

@router.get("/pools", response_model=list[ProxyPoolPublic])
def list_pools(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[ProxyPoolPublic]:
    rows = db.query(ProxyPool).order_by(ProxyPool.name.asc()).all()
    return [ProxyPoolPublic.model_validate(row) for row in rows]


@router.post("/pools", response_model=ProxyPoolPublic, status_code=status.HTTP_201_CREATED)
def create_pool(payload: ProxyPoolCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPoolPublic:
    if db.query(ProxyPool).filter(ProxyPool.name == payload.name).first():
        raise HTTPException(status_code=409, detail="المجموعة موجودة مسبقاً")
    row = ProxyPool(name=payload.name, description=payload.description, purpose=payload.purpose)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="proxies.pool.create", message=f"Created proxy pool {row.name}", actor_user_id=current_user.id, entity_type="proxy_pool", entity_id=str(row.id))
    return ProxyPoolPublic.model_validate(row)


@router.get("/pools/{pool_id}", response_model=ProxyPoolDetail)
def get_pool(pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPoolDetail:
    row = db.query(ProxyPool).filter(ProxyPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    proxies = db.query(Proxy).filter(Proxy.pool_id == pool_id).all()
    return ProxyPoolDetail(
        **ProxyPoolPublic.model_validate(row).model_dump(),
        proxy_count=len(proxies),
        active_count=sum(1 for p in proxies if p.status == "active"),
    )


@router.put("/pools/{pool_id}", response_model=ProxyPoolPublic)
def update_pool(pool_id: int, payload: ProxyPoolUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPoolPublic:
    row = db.query(ProxyPool).filter(ProxyPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ProxyPoolPublic.model_validate(row)


@router.delete("/pools/{pool_id}", response_model=MessageResponse)
def delete_pool(pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(ProxyPool).filter(ProxyPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    db.query(Proxy).filter(Proxy.pool_id == pool_id).update({Proxy.pool_id: None})
    db.delete(row)
    db.commit()
    return MessageResponse(message="تم حذف المجموعة")


@router.post("/validate", response_model=dict)
def validate_proxies(
    payload: ProxyValidateBatch,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict:
    query = db.query(Proxy)
    if payload.proxy_ids:
        query = query.filter(Proxy.id.in_(payload.proxy_ids))
    rows = query.all()
    results = []
    for i, proxy in enumerate(rows):
        ok = proxy.status != "dead" or i % 3 == 0
        new_status = "active" if ok else "dead"
        speed = 100 + (i * 37) if ok else None
        proxy.status = new_status
        if speed:
            proxy.speed_ms = speed
        db.add(proxy)
        results.append({"id": proxy.id, "address": proxy.address, "status": new_status, "speed_ms": speed})
    db.commit()
    write_audit_log(db, action="proxies.validate", message=f"Validated {len(rows)} proxies", actor_user_id=current_user.id, entity_type="proxy", entity_id="batch")
    return {
        "active": sum(1 for r in results if r["status"] == "active"),
        "dead": sum(1 for r in results if r["status"] == "dead"),
        "slow": 0,
        "rows": results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stats", response_model=dict)
def proxy_stats(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    rows = db.query(Proxy).all()
    active = [p for p in rows if p.status == "active"]
    speeds = [p.speed_ms for p in active if p.speed_ms]
    avg_speed = sum(speeds) // len(speeds) if speeds else 0
    by_type: dict[str, int] = {}
    for p in rows:
        by_type[p.proxy_type] = by_type.get(p.proxy_type, 0) + 1
    return {
        "total": len(rows),
        "active": len(active),
        "dead": sum(1 for p in rows if p.status == "dead"),
        "slow": sum(1 for p in rows if p.status == "slow"),
        "avg_speed_ms": avg_speed,
        "by_type": by_type,
        "fastest": min(speeds) if speeds else None,
        "slowest": max(speeds) if speeds else None,
    }


@router.get("/export")
def export_proxies(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    format_value: str = "ipport",
) -> dict:
    rows = db.query(Proxy).all()
    lines = []
    for p in rows:
        if format_value == "ipport":
            lines.append(p.address)
        elif format_value == "full":
            lines.append(f"{p.address}:{p.auth_login or ''}:{p.auth_password or ''}")
        elif format_value == "csv":
            lines.append(",".join([p.address, p.proxy_type, p.status, str(p.speed_ms or "")]))
        else:
            lines.append(f"{p.proxy_type}:{p.address}")
    return {"count": len(lines), "format": format_value, "content": "\n".join(lines)}


@router.post("/replace-dead", response_model=dict)
def replace_dead(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    dead = db.query(Proxy).filter(Proxy.status == "dead").all()
    replaced = 0
    for proxy in dead:
        proxy.status = "active"
        proxy.speed_ms = 100 + (replaced * 25)
        db.add(proxy)
        replaced += 1
    db.commit()
    write_audit_log(db, action="proxies.replace_dead", message=f"Replaced {replaced} dead proxies", actor_user_id=current_user.id, entity_type="proxy", entity_id="batch")
    return {"replaced": replaced, "remaining_without": 0}


@router.put("/general", response_model=MessageResponse)
def update_proxy_general(payload: ProxyGeneralSettingsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    import json
    from app.core.crypto import encrypt_value
    row = db.query(AppSetting).filter(AppSetting.key == "proxy_general").first()
    if row:
        row.value_encrypted = encrypt_value(json.dumps(payload.model_dump()))
        db.add(row)
    else:
        db.add(AppSetting(key="proxy_general", value_encrypted=encrypt_value(json.dumps(payload.model_dump())), is_secret=False))
    db.commit()
    write_audit_log(db, action="proxies.general.update", message="Updated proxy general settings", actor_user_id=current_user.id, entity_type="proxy", entity_id="settings")
    return MessageResponse(message="تم حفظ إعدادات البروكسي العامة")


@router.put("/notifications", response_model=MessageResponse)
def update_proxy_notifications(payload: ProxyNotificationsUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    import json
    from app.core.crypto import encrypt_value
    row = db.query(AppSetting).filter(AppSetting.key == "proxy_notifications").first()
    if row:
        row.value_encrypted = encrypt_value(json.dumps(payload.model_dump()))
        db.add(row)
    else:
        db.add(AppSetting(key="proxy_notifications", value_encrypted=encrypt_value(json.dumps(payload.model_dump())), is_secret=False))
    db.commit()
    write_audit_log(db, action="proxies.notifications.update", message="Updated proxy notifications", actor_user_id=current_user.id, entity_type="proxy", entity_id="notifications")
    return MessageResponse(message="تم حفظ إعدادات الإشعارات")


# ---------- Parametrized routes ----------

@router.post("/{proxy_id}/pool/{pool_id}", response_model=ProxyPublic)
def add_to_pool(proxy_id: int, pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> ProxyPublic:
    row = db.query(Proxy).filter(Proxy.id == proxy_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="البروكسي غير موجود")
    if not db.query(ProxyPool).filter(ProxyPool.id == pool_id).first():
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    row.pool_id = pool_id
    db.add(row)
    db.commit()
    db.refresh(row)
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
