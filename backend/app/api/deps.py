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

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")

DbSession = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


def get_current_user(db: DbSession, token: TokenDep) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise credentials_exception
    return user


def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


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


def require_admin(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
