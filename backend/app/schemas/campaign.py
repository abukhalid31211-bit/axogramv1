from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CampaignBase(BaseModel):
    name: str
    kind: str = "group"
    status: str = "draft"
    progress: int = 0
    total: int = 0
    sent: int = 0


class CampaignCreate(CampaignBase):
    message_text: str | None = None
    message_kind: str = "text"
    groups_json: str | None = None
    recipients_json: str | None = None
    settings_json: str | None = None
    delete_after_hours: int | None = None
    auto_leave_new_groups: bool = False
    account_ids_json: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    kind: str | None = None
    status: str | None = None
    progress: int | None = None
    total: int | None = None
    sent: int | None = None
    message_text: str | None = None
    message_kind: str | None = None
    groups_json: str | None = None
    recipients_json: str | None = None
    settings_json: str | None = None
    delete_after_hours: int | None = None
    auto_leave_new_groups: bool | None = None
    account_ids_json: str | None = None


class CampaignPublic(CampaignBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message_text: str | None = None
    message_kind: str | None = None
    groups_json: str | None = None
    recipients_json: str | None = None
    settings_json: str | None = None
    delete_after_hours: int | None = None
    auto_leave_new_groups: bool | None = None
    account_ids_json: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime


class CampaignStats(BaseModel):
    total: int
    active: int
    paused: int
    done: int
    drafts: int
    dm: int
    group: int
    total_sent: int


class CampaignStartPayload(BaseModel):
    scheduled_at: datetime | None = None


class CampaignRetryPayload(BaseModel):
    failed_items: list[str] = []


class CampaignTestSendPayload(BaseModel):
    target: str
    account_id: int | None = None
    message: str | None = None


class CampaignReport(BaseModel):
    campaign_id: int
    campaign_name: str
    success: int
    skipped: int
    failed: int
    total: int
    failure_reasons: dict[str, int]
    per_account: dict[str, dict]
    failed_items: list
    duration_minutes: float
    generated_at: str


class MessageTemplateBase(BaseModel):
    name: str
    kind: str = "group"
    message_kind: str = "text"
    category: str | None = None
    content: str


class MessageTemplateCreate(MessageTemplateBase):
    pass


class MessageTemplateUpdate(BaseModel):
    name: str | None = None
    message_kind: str | None = None
    category: str | None = None
    content: str | None = None


class MessageTemplatePublic(MessageTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CampaignScheduleCreate(BaseModel):
    campaign_id: int | None = None
    campaign_name: str
    kind: str = "group"
    pattern: str = "one_time"
    next_run: datetime | None = None


class CampaignSchedulePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int | None = None
    campaign_name: str
    kind: str
    pattern: str
    next_run: datetime | None = None
    runs: int
    status: str
    created_at: datetime
