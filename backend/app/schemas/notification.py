from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationSettingsUpdate(BaseModel):
    enabled: bool = True
    target: str | None = None
    account_phone: str | None = None
    bot_token: str | None = None
    on_campaign_done: bool = True
    on_account_blocked: bool = True
    on_proxy_dead: bool = True
    on_errors: bool = True
    daily_report: bool = True


class NotificationEventPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    level: str
    title: str
    message: str
    details_json: str | None = None
    delivery_status: str
    delivery_error: str | None = None
    created_at: datetime
    sent_at: datetime | None = None


class NotificationTestPayload(BaseModel):
    target: str | None = None
