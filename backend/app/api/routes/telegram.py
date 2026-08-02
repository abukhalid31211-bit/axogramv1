from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError

from app.api.deps import DbSession, get_current_active_user, require_module
from app.core.crypto import decrypt_value, encrypt_value
from app.db.models import Account, TelegramAuthSession, User
from app.schemas.account import AccountPublic
from app.schemas.telegram import (
    TelegramAuthSessionPublic,
    TelegramRequestCodePayload,
    TelegramRequestCodeResponse,
    TelegramStatusResponse,
    TelegramVerifyCodePayload,
    TelegramVerifyCodeResponse,
)
from app.services.audit import write_audit_log
from app.services.settings import get_telegram_credentials, resolve_telegram_credentials
from app.services.subscription import is_platform_admin, quota_error
from app.services.telegram_auth import build_client, phone_to_session_path

router = APIRouter(prefix="/telegram", tags=["telegram"], dependencies=[Depends(require_module("accounts"))])


@router.get("/status", response_model=TelegramStatusResponse)
def telegram_status(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> TelegramStatusResponse:
    """Whether the platform owner configured the shared Telegram API credentials.

    Subscribers never provide API ID/Hash themselves — they only need to know
    whether linking accounts is possible right now.
    """
    api_id, api_hash, _source = resolve_telegram_credentials(db)
    configured = bool(api_id and api_hash)
    return TelegramStatusResponse(
        configured=configured,
        has_api_id=bool(api_id),
        has_api_hash=bool(api_hash),
        sessions_path=str(phone_to_session_path("sample").parent),
        managed_by_admin=True,
        message=(
            None
            if configured
            else (
                "بيانات Telegram API تُضبط من إدارة المنصة — تواصل مع الإدارة لتفعيل ربط الحسابات"
                if not is_platform_admin(current_user)
                else "اضبط Telegram API ID و API Hash من لوحة الإدارة → 🔑 API تيليجرام"
            )
        ),
    )


@router.get("/auth-sessions", response_model=list[TelegramAuthSessionPublic])
def list_auth_sessions(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[TelegramAuthSessionPublic]:
    rows = db.query(TelegramAuthSession).order_by(TelegramAuthSession.updated_at.desc()).all()
    return [TelegramAuthSessionPublic.model_validate(row) for row in rows]


@router.post("/auth/request-code", response_model=TelegramRequestCodeResponse)
async def request_code(
    payload: TelegramRequestCodePayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> TelegramRequestCodeResponse:
    try:
        api_id, api_hash = get_telegram_credentials(db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    client = build_client(payload.phone, api_id, api_hash)
    try:
        await client.connect()
        result = await client.send_code_request(payload.phone)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"تعذر إرسال الرمز: {exc}") from exc
    finally:
        await client.disconnect()

    row = db.query(TelegramAuthSession).filter(TelegramAuthSession.phone == payload.phone).order_by(TelegramAuthSession.id.desc()).first()
    if not row:
        row = TelegramAuthSession(phone=payload.phone)
    row.phone_code_hash_encrypted = encrypt_value(result.phone_code_hash)
    row.session_file_path = str(phone_to_session_path(payload.phone))
    row.status = "code_sent"
    row.needs_password = False
    row.error_message = None
    db.add(row)
    db.commit()
    db.refresh(row)

    write_audit_log(
        db,
        action="telegram.request_code",
        message=f"Requested Telegram OTP for {payload.phone}",
        actor_user_id=current_user.id,
        entity_type="telegram_auth",
        entity_id=str(row.id),
    )
    return TelegramRequestCodeResponse(message="تم إرسال رمز التحقق", phone=payload.phone, session_path=row.session_file_path or "")


@router.post("/auth/verify-code", response_model=TelegramVerifyCodeResponse)
async def verify_code(
    payload: TelegramVerifyCodePayload,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> TelegramVerifyCodeResponse:
    try:
        api_id, api_hash = get_telegram_credentials(db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    auth_session = (
        db.query(TelegramAuthSession)
        .filter(TelegramAuthSession.phone == payload.phone)
        .order_by(TelegramAuthSession.id.desc())
        .first()
    )
    if not auth_session or not auth_session.phone_code_hash_encrypted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="لم يتم العثور على جلسة تحقق، أرسل الرمز أولاً")

    client = build_client(payload.phone, api_id, api_hash)
    try:
        await client.connect()
        if payload.password:
            await client.sign_in(password=payload.password)
        else:
            if not payload.code:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="أدخل رمز التحقق")
            await client.sign_in(
                phone=payload.phone,
                code=payload.code,
                phone_code_hash=decrypt_value(auth_session.phone_code_hash_encrypted),
            )
        me = await client.get_me()
    except SessionPasswordNeededError:
        auth_session.needs_password = True
        auth_session.status = "needs_password"
        db.add(auth_session)
        db.commit()
        return TelegramVerifyCodeResponse(message="الحساب يتطلب كلمة مرور 2FA", needs_password=True)
    except PhoneCodeInvalidError as exc:
        auth_session.status = "failed"
        auth_session.error_message = "رمز التحقق غير صحيح"
        db.add(auth_session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="رمز التحقق غير صحيح") from exc
    except Exception as exc:
        auth_session.status = "failed"
        auth_session.error_message = str(exc)
        db.add(auth_session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"فشل التحقق: {exc}") from exc
    finally:
        await client.disconnect()

    full_name = " ".join(part for part in [getattr(me, "first_name", None), getattr(me, "last_name", None)] if part).strip() or payload.phone
    username = f"@{me.username}" if getattr(me, "username", None) else None
    session_path = str(phone_to_session_path(payload.phone))

    account = db.query(Account).filter(Account.phone == payload.phone).first()
    if account and account.owner_user_id not in (None, current_user.id) and not is_platform_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="هذا الرقم مرتبط باشتراك مستخدم آخر")
    if not account:
        quota_msg = quota_error(db, current_user, "account_link")
        if quota_msg:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=quota_msg)
        account = Account(phone=payload.phone, name=full_name)
    if account.owner_user_id is None:
        account.owner_user_id = current_user.id
    account.name = full_name
    account.username = username
    account.status = "active"
    account.last_used_label = "الآن"
    account.age_label = account.age_label or "مرتبط حديثاً"
    account.session_file_path = session_path
    account.telegram_user_id = str(me.id)
    db.add(account)
    db.commit()
    db.refresh(account)

    auth_session.status = "verified"
    auth_session.needs_password = False
    auth_session.error_message = None
    auth_session.account_id = account.id
    auth_session.session_file_path = session_path
    db.add(auth_session)
    db.commit()

    write_audit_log(
        db,
        action="telegram.verify_code",
        message=f"Linked Telegram account {payload.phone}",
        actor_user_id=current_user.id,
        entity_type="account",
        entity_id=str(account.id),
    )
    return TelegramVerifyCodeResponse(message="تم ربط الحساب وحفظ الجلسة", account=AccountPublic.model_validate(account))
