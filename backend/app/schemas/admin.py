from datetime import datetime

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Subscribers
# --------------------------------------------------------------------------

class SubscriberCreate(BaseModel):
    email: str
    password: str = Field(min_length=4)
    period_days: int = Field(default=30, ge=1, le=365000)
    modules: list[str] = Field(default_factory=list)
    quotas: dict[str, int] = Field(default_factory=dict)
    plan_name: str | None = None


class SubscriberPublic(BaseModel):
    id: int
    email: str
    status: str  # active | expiring_soon | expired | suspended
    remaining_seconds: int | None = None
    remaining_label: str | None = None
    expires_at: datetime | None = None
    suspended: bool = False
    plan_name: str | None = None
    modules: list[str] = Field(default_factory=list)
    quotas: dict[str, int] = Field(default_factory=dict)
    accounts_count: int = 0
    last_login: datetime | None = None
    created_at: datetime


class SubscriberDetail(SubscriberPublic):
    usage_today: dict[str, int] = Field(default_factory=dict)
    active_jobs: int = 0


class ModulesUpdate(BaseModel):
    modules: list[str]
    plan_name: str | None = None


class QuotasUpdate(BaseModel):
    quotas: dict[str, int]


class ExtendPayload(BaseModel):
    days: int = Field(ge=1, le=365000)


class ResetPasswordResponse(BaseModel):
    email: str
    password: str


class DeleteSubscriberPayload(BaseModel):
    confirm_email: str
    transfer_accounts_to_admin: bool = False


class AdminStats(BaseModel):
    total: int
    active: int
    expiring_soon: int
    expired: int
    suspended: int


# --------------------------------------------------------------------------
# Plans
# --------------------------------------------------------------------------

class PlanCreate(BaseModel):
    name: str
    price_label: str | None = None
    points: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)
    quotas: dict[str, int] = Field(default_factory=dict)


class PlanUpdate(BaseModel):
    name: str | None = None
    price_label: str | None = None
    points: list[str] | None = None
    modules: list[str] | None = None
    quotas: dict[str, int] | None = None
    apply_to_existing: bool = False


class PlanPublic(BaseModel):
    id: int
    name: str
    price_label: str | None = None
    points: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)
    quotas: dict[str, int] = Field(default_factory=dict)
    subscribers_count: int = 0
    created_at: datetime


# --------------------------------------------------------------------------
# Usage / broadcast / logs
# --------------------------------------------------------------------------

class UsageRow(BaseModel):
    user_id: int
    email: str
    status: str
    accounts: int = 0
    gather_today: int = 0
    add_today: int = 0
    dm_today: int = 0
    group_today: int = 0
    quotas: dict[str, int] = Field(default_factory=dict)
    active_jobs: int = 0


class BroadcastPayload(BaseModel):
    title: str = Field(default="تنبيه من الإدارة")
    message: str = Field(min_length=1)
    audience: str = Field(default="all")  # all | active | expiring_soon


class AdminLogEntry(BaseModel):
    id: int
    created_at: datetime
    level: str
    action: str
    message: str
    entity_type: str | None = None
    entity_id: str | None = None


class ModuleInfo(BaseModel):
    id: str
    label: str


class TelegramCredentialsResponse(BaseModel):
    api_id: str
    api_hash: str
    configured: bool


class TelegramCredentialsUpdate(BaseModel):
    api_id: str
    api_hash: str

