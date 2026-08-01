from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import DbSession, rate_limit
from app.core.security import create_access_token, verify_password
from app.db.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserPublic
from app.services.audit import write_audit_log
from app.services.subscription import subscription_status, to_user_public

router = APIRouter(prefix="/auth", tags=["auth"])


def _find_user(db: Session, identifier: str) -> User | None:
    ident = (identifier or "").strip()
    if not ident:
        return None
    user = db.query(User).filter(func.lower(User.email) == ident.lower()).first()
    if user:
        return user
    # Legacy fallback: allow login by username (old accounts without e-mail).
    return db.query(User).filter(User.username == ident).first()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession, request: Request) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    rate_limit(f"login:{client_ip}", limit=10, window_seconds=60)
    identifier = payload.email or payload.username or ""
    user: User | None = _find_user(db, identifier)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="البريد الإلكتروني أو كلمة المرور غير صحيحة",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="الحساب غير مفعّل")

    status_ = subscription_status(user)
    if status_ == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="الحساب موقوف مؤقتاً من الإدارة — تواصل مع المسؤول",
        )
    if status_ == "expired":
        expires_label = user.expires_at.strftime("%Y-%m-%d") if user.expires_at else ""
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"انتهى اشتراكك في {expires_label} — تواصل مع الإدارة للتجديد",
        )

    subject = (user.email or user.username or "").strip()
    token = create_access_token(subject=subject, role=user.role)
    write_audit_log(
        db,
        action="auth.login",
        message=f"User {user.email or user.username} logged in",
        actor_user_id=user.id,
    )
    return TokenResponse(access_token=token, user=to_user_public(user))
