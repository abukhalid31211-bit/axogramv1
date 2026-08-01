from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SecurityAuditItem(BaseModel):
    check: str
    status: str
    recommendation: str | None = None


class SecurityAuditResult(BaseModel):
    score: int
    excellent: int
    warnings: int
    critical: int
    items: list[SecurityAuditItem]
    generated_at: str


class DeviceSession(BaseModel):
    account_id: int | None = None
    phone: str
    hash: str | None = None
    device: str
    app: str
    ip: str
    last_active: str
    suspicious: bool = False
    current: bool = False


class Manage2FAUpdate(BaseModel):
    account_id: int
    current_password: str | None = None
    new_password: str
    apply_to_all: bool = False


class EncryptionSettingsUpdate(BaseModel):
    enabled: bool
    key: str | None = None
    current_key: str | None = None


class SecurityNotificationsUpdate(BaseModel):
    on_ban: bool = True
    on_restrict: bool = True
    flood_threshold: int = 5
    on_suspicious: bool = True
    on_proxy_dead: bool = True
    on_connect_fail: bool = False
    on_session_expiry: bool = False
    fail_percent: int = 30
    daily_report: bool = True
    weekly_report: bool = False


class EmergencyAction(BaseModel):
    action: str
    message: str | None = None
    account_ids: list[int] | None = None


class TerminateSessionPayload(BaseModel):
    hash: str
    all_others: bool = False


class BanMonitorSettingsUpdate(BaseModel):
    enabled: bool = True
    interval_minutes: int = 15
    action: str = "notify"  # notify | remove_rotation | pause_hour | stop_all


class CleanupPayload(BaseModel):
    account_ids: list[int] | None = None
    keep_recent_groups: int = 0
    delete_messages_older_days: int | None = None
    clear_chat_history: bool = False
    delete_contacts: bool = False
    reset_damaged: bool = False
    clear_cache: bool = False


class SecurityEventPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    level: str
    account_id: int | None = None
    message: str
    details_json: str | None = None
    created_at: datetime


class SecurityReport(BaseModel):
    date: str
    flood_waits: int
    bans: int
    restrictions: int
    suspicious: int
    alerts: int
    score: int
    events_count: int = 0
