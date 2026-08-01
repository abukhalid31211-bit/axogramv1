import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import ALGORITHM
from app.db.models import User
from app.db.session import get_db
from app.services.subscription import (
    MODULE_LABELS,
    blocked_reason,
    is_platform_admin,
    module_allowed,
)

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")

DbSession = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


def _resolve_user(db: Session, subject: str) -> User | None:
    """Tokens carry the user's email in `sub` (legacy tokens used username)."""
    subject_norm = (subject or "").strip()
    user = db.query(User).filter(User.email == subject_norm.lower()).first()
    if user:
        return user
    return db.query(User).filter(User.username == subject_norm).first()


def get_current_user(db: DbSession, token: TokenDep) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = _resolve_user(db, subject)
    if not user:
        raise credentials_exception
    return user


def _clients_locked(db: Session) -> bool:
    try:
        from app.services.settings import get_setting_value

        value = get_setting_value(db, "clients_locked")
        return str(value or "").strip().lower() in ("1", "true", "yes", "on")
    except Exception:
        return False


def get_current_active_user(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if is_platform_admin(current_user):
        return current_user
    # Emergency clients lock: only the platform admin may use the system.
    if _clients_locked(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="النظام في وضع صيانة مؤقت من الإدارة — عاود المحاولة لاحقاً",
        )
    reason = blocked_reason(current_user)
    if reason:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)
    return current_user


CurrentUser = Annotated[User, Depends(get_current_active_user)]


# --------------------------------------------------------------------------
# Simple in-process rate limiting for sensitive endpoints (e.g. login)
# --------------------------------------------------------------------------

_rate_buckets: dict[str, list[float]] = defaultdict(list)


def rate_limit(ip: str, *, limit: int, window_seconds: int) -> None:
    """Raise 429 when `ip` exceeded `limit` requests within `window_seconds`."""
    now = time.time()
    window_start = now - window_seconds
    bucket = _rate_buckets[ip]
    _rate_buckets[ip] = [ts for ts in bucket if ts >= window_start]
    if len(_rate_buckets[ip]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="عدد كبير من المحاولات — انتظر قليلاً ثم أعد المحاولة",
        )
    _rate_buckets[ip].append(now)


def require_admin(current_user: CurrentUser) -> User:
    """Legacy role check (kept for the old users admin endpoints)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_platform_admin(current_user: CurrentUser) -> User:
    """Only the permanent platform admin (identified by e-mail)."""
    if not is_platform_admin(current_user):
        raise HTTPException(status_code=404, detail="Not found")
    return current_user


PlatformAdmin = Annotated[User, Depends(require_platform_admin)]


def check_run_quota(db: Session, user: User, purpose: str) -> None:
    """Raise 403 when the subscriber exceeded a daily/account/concurrent quota."""
    from app.services.subscription import concurrent_jobs_error, quota_error

    msg = quota_error(db, user, purpose) or concurrent_jobs_error(db, user)
    if msg:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)


def require_module(module: str):
    """Dependency factory: enforce that the subscriber's plan includes `module`."""

    def checker(current_user: CurrentUser) -> User:
        if not module_allowed(current_user, module):
            label = MODULE_LABELS.get(module, module)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"🔒 هذه الوحدة غير مشمولة بباقتك — {label} — اطلب الترقية من الإدارة",
            )
        return current_user

    return checker
