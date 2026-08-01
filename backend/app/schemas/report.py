from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DashboardSummary(BaseModel):
    accounts_total: int
    accounts_active: int
    proxies_total: int
    proxies_active: int
    campaigns_active: int
    campaigns_total: int
    last_activity_at: datetime | None = None


class ActivityLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: str
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    message: str
    details_json: str | None = None
    actor_user_id: int | None = None
    created_at: datetime
