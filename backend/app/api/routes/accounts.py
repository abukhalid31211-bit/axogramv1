from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from sqlalchemy.orm import Session

from app.api.deps import DbSession, get_current_active_user, require_module
from app.db.models import Account, AccountPool, AppSetting, User
from app.schemas.account import (
    AccountCreate,
    AccountPoolCreate,
    AccountPoolDetail,
    AccountPoolPublic,
    AccountPoolUpdate,
    AccountPublic,
    AccountSettingsPayload,
    AccountUpdate,
    BulkProfilePayload,
    ProfileUpdatePayload,
    SessionImportFilesPayload,
    SessionImportStringPayload,
    SessionImportTextPayload,
)
from app.schemas.common import MessageResponse
from app.schemas.jobs import JobStartResponse
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.rotation import get_usage_snapshot, reset_usage
from app.services.subscription import is_platform_admin, quota_error

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _visible_account_or_404(db: Session, account_id: int, user: User) -> Account:
    account = _visible_account_or_404(db, account_id, current_user)
    if not is_platform_admin(user) and account.owner_user_id != user.id:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    return account


# ==========================================================================
# Static paths (must precede /{account_id})
# ==========================================================================

# ------------------------- Pools -------------------------

@router.get("/pools", response_model=list[AccountPoolPublic])
def list_pools(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[AccountPoolPublic]:
    rows = db.query(AccountPool).order_by(AccountPool.name.asc()).all()
    return [AccountPoolPublic.model_validate(row) for row in rows]


@router.post("/pools", response_model=AccountPoolPublic, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_module("accounts"))])
def create_pool(payload: AccountPoolCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPoolPublic:
    if db.query(AccountPool).filter(AccountPool.name == payload.name).first():
        raise HTTPException(status_code=409, detail="اسم المجموعة موجود مسبقاً")
    row = AccountPool(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.pools.create", message=f"إنشاء مجموعة حسابات {row.name}", actor_user_id=current_user.id, entity_type="account_pool", entity_id=str(row.id))
    return AccountPoolPublic.model_validate(row)


@router.get("/pools/{pool_id}", response_model=AccountPoolDetail)
def get_pool(pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPoolDetail:
    row = db.query(AccountPool).filter(AccountPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    accounts = db.query(Account).filter(Account.pool_id == pool_id).order_by(Account.id.asc()).all()
    return AccountPoolDetail(id=row.id, name=row.name, description=row.description, purpose=row.purpose, created_at=row.created_at, updated_at=row.updated_at, accounts=[AccountPublic.model_validate(a) for a in accounts])


@router.put("/pools/{pool_id}", response_model=AccountPoolPublic, dependencies=[Depends(require_module("accounts"))])
def update_pool(pool_id: int, payload: AccountPoolUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPoolPublic:
    row = db.query(AccountPool).filter(AccountPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.pools.update", message=f"تعديل مجموعة {row.name}", actor_user_id=current_user.id, entity_type="account_pool", entity_id=str(row.id))
    return AccountPoolPublic.model_validate(row)


@router.delete("/pools/{pool_id}", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
def delete_pool(pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = db.query(AccountPool).filter(AccountPool.id == pool_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    db.query(Account).filter(Account.pool_id == pool_id).update({Account.pool_id: None})
    db.delete(row)
    db.commit()
    write_audit_log(db, action="accounts.pools.delete", message=f"حذف مجموعة حسابات", actor_user_id=current_user.id, entity_type="account_pool", entity_id=str(pool_id), level="warn")
    return MessageResponse(message="تم حذف المجموعة")


# ------------------------- Session import -------------------------

@router.post("/import/sessions", response_model=JobStartResponse, dependencies=[Depends(require_module("accounts"))])
async def import_session_files(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    files: list[UploadFile] = File(...),
) -> JobStartResponse:
    """Import uploaded .session files (validate each via Telethon)."""
    from app.core.config import get_settings as _gs

    settings = _gs()
    sessions_dir = settings.storage_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for file in files:
        if not (file.filename or "").endswith(".session"):
            continue
        target = sessions_dir / file.filename
        target.write_bytes(await file.read())
        paths.append(str(target))
    if not paths:
        raise HTTPException(status_code=400, detail="لم يتم رفع أي ملفات .session صالحة")
    job_id = jobrunner.start_job(
        kind="sessions_import",
        label=f"استيراد {len(paths)} ملف جلسة",
        entity_type="account",
        entity_id="import",
        actor_user_id=current_user.id,
        payload={"method": "files", "paths": paths, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء فحص الجلسات واستيراد الصالحة منها", job_id=job_id)


@router.post("/import/zip", response_model=JobStartResponse, dependencies=[Depends(require_module("accounts"))])
async def import_session_zip(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
    password: str | None = None,
) -> JobStartResponse:
    from app.core.config import get_settings as _gs

    settings = _gs()
    sessions_dir = settings.storage_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    target = sessions_dir / f"import_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{(file.filename or 'archive.zip')}"
    target.write_bytes(await file.read())
    job_id = jobrunner.start_job(
        kind="sessions_import",
        label=f"استيراد جلسات من {file.filename or 'ZIP'}",
        entity_type="account",
        entity_id="import",
        actor_user_id=current_user.id,
        payload={"method": "zip", "zip_path": str(target), "password": password, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء فك الضغط وفحص الجلسات", job_id=job_id)


@router.post("/import/string", response_model=JobStartResponse, dependencies=[Depends(require_module("accounts"))])
def import_string_sessions(payload: SessionImportStringPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    sessions = [s.strip() for s in payload.sessions if s.strip()]
    if not sessions:
        raise HTTPException(status_code=400, detail="أدخل Session واحداً على الأقل")
    job_id = jobrunner.start_job(
        kind="sessions_import",
        label=f"استيراد {len(sessions)} String Session",
        entity_type="account",
        entity_id="import",
        actor_user_id=current_user.id,
        payload={"method": "string", "sessions": sessions, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء فحص وتحويل الجلسات", job_id=job_id)


@router.post("/import/text", response_model=JobStartResponse, dependencies=[Depends(require_module("accounts"))])
def import_text_sessions(payload: SessionImportTextPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="الملف النصي فارغ")
    job_id = jobrunner.start_job(
        kind="sessions_import",
        label="استيراد جلسات من ملف نصي",
        entity_type="account",
        entity_id="import",
        actor_user_id=current_user.id,
        payload={"method": "text", "content": payload.content, "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء تحليل الملف النصي", job_id=job_id)


# ------------------------- Usage -------------------------

@router.get("/usage")
def account_usage(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], date: str | None = None) -> dict:
    return {"date": date or datetime.now(timezone.utc).strftime("%Y-%m-%d"), "rows": get_usage_snapshot(db, date)}


@router.post("/usage/reset", response_model=MessageResponse)
def reset_account_usage(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], date: str | None = None) -> MessageResponse:
    deleted = reset_usage(db, date)
    return MessageResponse(message=f"تم تصفير الاستخدام ({deleted} سجل)")


# ==========================================================================
# Parametrized routes
# ==========================================================================

@router.get("", response_model=list[AccountPublic])
def list_accounts(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    search: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    pool_id: int | None = Query(default=None),
) -> list[AccountPublic]:
    query = db.query(Account)
    if not is_platform_admin(current_user):
        query = query.filter(Account.owner_user_id == current_user.id)
    if search:
        query = query.filter(Account.name.ilike(f"%{search}%") | Account.phone.ilike(f"%{search}%") | Account.username.ilike(f"%{search}%"))
    if status_value:
        query = query.filter(Account.status == status_value)
    if pool_id:
        query = query.filter(Account.pool_id == pool_id)
    rows = query.order_by(Account.id.asc()).all()
    return [AccountPublic.model_validate(row) for row in rows]


@router.post("", response_model=AccountPublic, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_module("accounts"))])
def create_account(payload: AccountCreate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    quota_msg = quota_error(db, current_user, "account_link")
    if quota_msg:
        raise HTTPException(status_code=403, detail=quota_msg)
    if db.query(Account).filter(Account.phone == payload.phone).first():
        raise HTTPException(status_code=409, detail="رقم الهاتف موجود مسبقاً")
    row = Account(**payload.model_dump())
    row.owner_user_id = current_user.id
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.create", message=f"إنشاء حساب {row.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(row.id))
    return AccountPublic.model_validate(row)


@router.post("/{account_id}/pool/{pool_id}", response_model=AccountPublic, dependencies=[Depends(require_module("accounts"))])
def assign_to_pool(account_id: int, pool_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    account = _visible_account_or_404(db, account_id, current_user)
    if not db.query(AccountPool).filter(AccountPool.id == pool_id).first():
        raise HTTPException(status_code=404, detail="المجموعة غير موجودة")
    account.pool_id = pool_id
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountPublic.model_validate(account)


@router.delete("/{account_id}/pool", response_model=AccountPublic, dependencies=[Depends(require_module("accounts"))])
def unassign_from_pool(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    account = _visible_account_or_404(db, account_id, current_user)
    account.pool_id = None
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountPublic.model_validate(account)


@router.get("/{account_id}", response_model=AccountPublic)
def get_account(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    row = _visible_account_or_404(db, account_id, current_user)
    return AccountPublic.model_validate(row)


@router.put("/{account_id}", response_model=AccountPublic, dependencies=[Depends(require_module("accounts"))])
def update_account(account_id: int, payload: AccountUpdate, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> AccountPublic:
    row = _visible_account_or_404(db, account_id, current_user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="accounts.update", message=f"تحديث حساب {row.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(row.id))
    return AccountPublic.model_validate(row)


@router.delete("/{account_id}", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
def delete_account(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    row = _visible_account_or_404(db, account_id, current_user)
    phone = row.phone
    db.delete(row)
    db.commit()
    write_audit_log(db, action="accounts.delete", message=f"حذف حساب {phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id), level="warn")
    return MessageResponse(message="تم حذف الحساب")


# ------------------------- Telegram sessions (real devices) -------------------------

@router.get("/{account_id}/telegram-sessions")
def account_telegram_sessions(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[dict]:
    from app.services.security import get_account_sessions

    account = _visible_account_or_404(db, account_id, current_user)
    try:
        return get_account_sessions(db, account)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"تعذر جلب الجلسات: {exc}") from exc


@router.post("/{account_id}/telegram-sessions/terminate", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
def terminate_telegram_session(account_id: int, payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    from app.services.security import terminate_account_session

    account = _visible_account_or_404(db, account_id, current_user)
    try:
        terminated = terminate_account_session(db, account, hash_value=payload.get("hash"), all_others=bool(payload.get("all_others")))
        write_audit_log(db, action="accounts.sessions.terminate", message=f"إنهاء جلسات ({terminated}) لحساب {account.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id), level="warn")
        return MessageResponse(message=f"تم إنهاء {terminated} جلسة")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"تعذر إنهاء الجلسات: {exc}") from exc


# ------------------------- Profile management -------------------------

@router.put("/{account_id}/profile", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
def update_account_profile(account_id: int, payload: ProfileUpdatePayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    from app.services.security import update_account_profile

    account = _visible_account_or_404(db, account_id, current_user)
    try:
        update_account_profile(
            db,
            account,
            first_name=payload.first_name,
            last_name=payload.last_name,
            bio=payload.bio,
            username=payload.username,
        )
        if payload.username:
            account.username = f"@{payload.username.lstrip('@')}"
        db.add(account)
        db.commit()
        write_audit_log(db, action="accounts.profile.update", message=f"تحديث ملف حساب {account.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id))
        return MessageResponse(message="تم تحديث الملف الشخصي")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"تعذر التحديث: {exc}") from exc


@router.post("/{account_id}/profile/photo", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
async def update_account_photo(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)], file: UploadFile = File(...)) -> MessageResponse:
    from app.services.security import update_account_photo

    account = _visible_account_or_404(db, account_id, current_user)
    from app.core.config import get_settings as _gs

    target = _gs().storage_path / "uploads" / f"photo_{account_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{file.filename or 'photo.jpg'}"
    target.write_bytes(await file.read())
    try:
        update_account_photo(db, account, str(target))
        write_audit_log(db, action="accounts.profile.photo", message=f"تغيير صورة حساب {account.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id))
        return MessageResponse(message="تم تغيير الصورة الشخصية")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"تعذر تغيير الصورة: {exc}") from exc


@router.post("/profile/bulk", response_model=JobStartResponse, dependencies=[Depends(require_module("accounts"))])
def bulk_profile_update(payload: BulkProfilePayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> JobStartResponse:
    job_id = jobrunner.start_job(
        kind="account_profile_bulk",
        label="تحديث ملفات شخصية جماعي",
        entity_type="account",
        entity_id="bulk",
        actor_user_id=current_user.id,
        payload={**payload.model_dump(), "actor_user_id": current_user.id},
    )
    return JobStartResponse(mode="queued", message="تم بدء التحديث الجماعي للملفات الشخصية", job_id=job_id)


# ------------------------- Individual Settings -------------------------

@router.get("/{account_id}/settings")
def get_account_settings(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    """Load individual account settings from app_settings."""
    from app.services.settings import get_setting_value

    account = _visible_account_or_404(db, account_id, current_user)
    prefix = f"account_{account_id}_"
    return {
        "account_id": account_id,
        "gather_limit": int(get_setting_value(db, f"{prefix}gather_limit") or 500),
        "add_limit": int(get_setting_value(db, f"{prefix}add_limit") or 20),
        "dm_limit": int(get_setting_value(db, f"{prefix}dm_limit") or 30),
        "delay_min": int(get_setting_value(db, f"{prefix}delay_min") or 60),
        "delay_max": int(get_setting_value(db, f"{prefix}delay_max") or 120),
        "priority": get_setting_value(db, f"{prefix}priority") or "mid",
        "allow_gather": (get_setting_value(db, f"{prefix}allow_gather") or "true").lower() == "true",
        "allow_add": (get_setting_value(db, f"{prefix}allow_add") or "true").lower() == "true",
        "allow_dm": (get_setting_value(db, f"{prefix}allow_dm") or "true").lower() == "true",
        "allow_campaign": (get_setting_value(db, f"{prefix}allow_campaign") or "true").lower() == "true",
        "allow_rotation": (get_setting_value(db, f"{prefix}allow_rotation") or "true").lower() == "true",
        "limit_work_hours": (get_setting_value(db, f"{prefix}limit_work_hours") or "false").lower() == "true",
        "work_hours_from": get_setting_value(db, f"{prefix}work_hours_from") or "08:00",
        "work_hours_to": get_setting_value(db, f"{prefix}work_hours_to") or "22:00",
    }


@router.put("/{account_id}/settings", response_model=MessageResponse, dependencies=[Depends(require_module("accounts"))])
def save_account_settings(account_id: int, payload: AccountSettingsPayload, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> MessageResponse:
    """Save individual account settings to app_settings."""
    account = _visible_account_or_404(db, account_id, current_user)
    prefix = f"account_{account_id}_"
    _save_setting(db, f"{prefix}gather_limit", str(payload.gather_limit or 500))
    _save_setting(db, f"{prefix}add_limit", str(payload.add_limit or 20))
    _save_setting(db, f"{prefix}dm_limit", str(payload.dm_limit or 30))
    _save_setting(db, f"{prefix}delay_min", str(payload.delay_min or 60))
    _save_setting(db, f"{prefix}delay_max", str(payload.delay_max or 120))
    _save_setting(db, f"{prefix}priority", payload.priority or "mid")
    _save_setting(db, f"{prefix}allow_gather", str(payload.allow_gather if payload.allow_gather is not None else True))
    _save_setting(db, f"{prefix}allow_add", str(payload.allow_add if payload.allow_add is not None else True))
    _save_setting(db, f"{prefix}allow_dm", str(payload.allow_dm if payload.allow_dm is not None else True))
    _save_setting(db, f"{prefix}allow_campaign", str(payload.allow_campaign if payload.allow_campaign is not None else True))
    _save_setting(db, f"{prefix}allow_rotation", str(payload.allow_rotation if payload.allow_rotation is not None else True))
    _save_setting(db, f"{prefix}limit_work_hours", str(payload.limit_work_hours or False))
    _save_setting(db, f"{prefix}work_hours_from", payload.work_hours_from or "08:00")
    _save_setting(db, f"{prefix}work_hours_to", payload.work_hours_to or "22:00")
    write_audit_log(db, action="accounts.settings.update", message=f"تحديث إعدادات فردية للحساب {account.phone}", actor_user_id=current_user.id, entity_type="account", entity_id=str(account_id))
    return MessageResponse(message="تم حفظ الإعدادات الفردية")


def _save_setting(db: Session, key: str, value: str) -> None:
    from app.core.crypto import encrypt_value
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value_encrypted = encrypt_value(value)
        db.add(row)
    else:
        db.add(AppSetting(key=key, value_encrypted=encrypt_value(value), is_secret=False))
    db.commit()


@router.get("/{account_id}/export/session")
def export_account_session(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    account = _visible_account_or_404(db, account_id, current_user)
    if not account.session_file_path:
        raise HTTPException(status_code=404, detail="ملف الجلسة غير موجود لهذا الحساب")
    from fastapi.responses import FileResponse
    from pathlib import Path
    path = Path(account.session_file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="ملف الجلسة غير موجود على السيرفر")
    return FileResponse(path, media_type="application/octet-stream", filename=f"{account.phone}.session")


@router.get("/{account_id}/export/string-session")
def export_account_string_session(account_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    account = _visible_account_or_404(db, account_id, current_user)
    if not account.session_file_path:
        raise HTTPException(status_code=404, detail="ملف الجلسة غير موجود لهذا الحساب")
    try:
        from telethon.sessions import StringSession, SQLiteSession
        from pathlib import Path
        path = Path(account.session_file_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="ملف الجلسة غير موجود على السيرفر")
        session = SQLiteSession(str(path))
        dc_id = session.dc_id
        server_address = session.server_address
        port = session.port
        auth_key = session.auth_key
        if not auth_key:
            raise ValueError("مفتاح المصادقة فارغ في الجلسة")
        s = StringSession()
        s.set_dc(dc_id, server_address, port)
        s.auth_key = auth_key
        string_val = s.save()
        return {"string_session": string_val}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"تعذر توليد String Session: {exc}")

