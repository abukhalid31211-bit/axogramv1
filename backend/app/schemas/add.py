from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AddOperationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_label: str
    source_type: str
    target_label: str
    method: str
    status: str
    total_count: int
    success_count: int
    skipped_count: int
    failed_count: int
    details_json: str | None = None
    created_by: int | None = None
    created_at: datetime


class AddStatsResponse(BaseModel):
    total_operations: int
    total_success: int
    total_failed: int
    total_skipped: int
    latest_operation_at: datetime | None = None


class BlacklistEntryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_value: str
    reason: str | None = None
    created_by: int | None = None
    created_at: datetime


class BlacklistEntryCreate(BaseModel):
    user_value: str
    reason: str | None = None


class AddFromExportJobPayload(BaseModel):
    export_id: int
    target_label: str
    method: str = "direct"
    run_inline: bool = False
    rotation_style: str | None = None
    distribution_style: str | None = None
    add_limit: int | None = None
    delay: str | None = None
    switch_delay: str | None = None
    daily_limit: int | None = None
    smart_limit: bool | None = None
    smart_delay: bool | None = None
    protection: dict | None = None
    stop_limit: int | None = None


class AddManualJobPayload(BaseModel):
    users: list[str]
    target_label: str
    method: str = "direct"
    run_inline: bool = False


class AddResult(BaseModel):
    operation_id: int
    total_count: int
    success_count: int
    skipped_count: int
    failed_count: int
    source_label: str
    target_label: str
    generated_at: str


class SmartAddJobPayload(BaseModel):
    source_label: str
    target_label: str
    method: str = "direct"
    limit: int = 1000
    run_inline: bool = False


class MultiSourceAddJobPayload(BaseModel):
    export_ids: list[int]
    group_links: list[str] = []
    target_label: str
    method: str = "direct"
    deduplicate: bool = True
    run_inline: bool = False


class AddDefaultsPayload(BaseModel):
    values: dict[str, str]
