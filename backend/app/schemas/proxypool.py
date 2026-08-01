from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProxyPoolCreate(BaseModel):
    name: str
    description: str | None = None
    purpose: str = "multi"


class ProxyPoolUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    purpose: str | None = None


class ProxyPoolPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    purpose: str
    created_at: datetime
    updated_at: datetime


class ProxyPoolDetail(ProxyPoolPublic):
    proxy_count: int = 0
    active_count: int = 0


class ProxyValidateBatch(BaseModel):
    proxy_ids: list[int] | None = None
    run_inline: bool = False


class ProxyGeneralSettingsUpdate(BaseModel):
    timeout: int = 10
    retries: int = 3
    retry_delay: int = 5
    dns_over_proxy: bool = True
    auto_check: bool = True
    auto_replace: bool = False
    auto_rotate: bool = False


class ProxyNotificationsUpdate(BaseModel):
    on_dead: bool = True
    on_expiry: bool = False
    slow_ms_threshold: int = 400
    dead_percent_threshold: int = 50
    daily_report: bool = False
    on_assign_result: bool = True
