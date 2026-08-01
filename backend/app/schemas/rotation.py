from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RotationSettingUpdate(BaseModel):
    mode: str | None = None
    condition: str | None = None
    on_block: str | None = None
    on_limit: str | None = None
    switch_ops: int | None = None
    delay_min: int | None = None
    delay_max: int | None = None
    rest_after: int | None = None
    work_from: str | None = None
    work_to: str | None = None
    work_days: list[str] | None = None


class RotationTableRow(BaseModel):
    position: int
    account_id: int
    phone: str
    health: int
    gather: int
    add: int
    dm: int
    status: str
    next_phone: str | None = None


class RotationUsageRow(BaseModel):
    account_id: int
    phone: str
    gather: int
    add: int
    dm: int
    groups: int
    status: str
    remaining: int


class RotationProfile(BaseModel):
    id: str
    name: str
    icon: str
    lines: list[str]
    delay_min: int
    delay_max: int
    switch_ops: int
    rest_after: int
    daily_add_limit: int


class RotationExclusionRules(BaseModel):
    blocked: bool = True
    restricted: bool = True
    health_threshold: int | None = None
    exclude_new: bool = False
    flood_threshold: int | None = None
    require_proxy: bool = False
    respect_hours: bool = False


class RotationNotificationsUpdate(BaseModel):
    on_switch: bool = True
    on_exclude: bool = True
    on_all_limit: bool = True
    on_resume: bool = True
    daily: bool = True
    stale_minutes: int = 30


class RotationAnalytics(BaseModel):
    switches_today: int
    switches_week: int
    avg_ops_before_switch: int
    switch_reasons: dict[str, int]
    last_switch_at: datetime | None = None


class RotationLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_phone: str
    to_phone: str
    reason: str
    switched_at: datetime
