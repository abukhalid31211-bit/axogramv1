from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProxyBase(BaseModel):
    address: str
    proxy_type: str = "SOCKS5"
    status: str = "active"
    speed_ms: int | None = None
    auth_login: str | None = None
    auth_password: str | None = None
    notes: str | None = None


class ProxyCreate(ProxyBase):
    pass


class ProxyUpdate(BaseModel):
    address: str | None = None
    proxy_type: str | None = None
    status: str | None = None
    speed_ms: int | None = None
    auth_login: str | None = None
    auth_password: str | None = None
    notes: str | None = None


class ProxyPublic(ProxyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
