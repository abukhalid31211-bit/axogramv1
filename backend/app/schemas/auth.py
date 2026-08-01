from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Login by e-mail (legacy clients may still send `username`)."""

    email: str | None = None
    username: str | None = None
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: datetime
    # Admin-panel / subscription fields (computed or stored)
    platform_admin: bool = False
    plan_name: str | None = None
    modules: list[str] = Field(default_factory=list)
    quotas: dict[str, int] = Field(default_factory=dict)
    expires_at: datetime | None = None
    suspended: bool = False
    subscription_status: str = "active"
    remaining_seconds: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserNotices(BaseModel):
    """Polled by the client warning bar: subscription warning + admin broadcast."""

    subscription_status: str
    remaining_seconds: int | None = None
    remaining_label: str | None = None
    expires_at: datetime | None = None
    broadcast: dict | None = None  # {title, message, sent_at}


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    role: str = "user"
    is_active: bool = True


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
