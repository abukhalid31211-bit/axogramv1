from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class GatherExportPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_label: str
    source_type: str
    file_name: str
    file_path: str
    member_count: int
    status: str
    notes: str | None = None
    created_by: int | None = None
    created_at: datetime


class GatherStatsResponse(BaseModel):
    total_exports: int
    total_members: int
    latest_export_at: datetime | None = None


class GatherExtractJobPayload(BaseModel):
    source_label: str
    source_type: str = "public"
    extract_mode: str = "all"
    limit: int = 1000
    account_id: int | None = None
    run_inline: bool = False


class GatherMergeJobPayload(BaseModel):
    export_ids: list[int]
    deduplicate: bool = True
    run_inline: bool = False


class GatherCleanJobPayload(BaseModel):
    export_id: int
    deduplicate: bool = True
    keep_with_username: bool = False
    keep_with_phone: bool = False
    remove_bots: bool = True


class GatherExtractResult(BaseModel):
    export_id: int
    file_name: str
    member_count: int
    source_label: str
    execution_mode: str = "telethon"
    warning: str | None = None
    generated_at: str


class GatherMergeResult(BaseModel):
    export_id: int
    file_name: str
    input_count: int
    member_count: int
    deduplicated: bool
    generated_at: str


class GatherTemplateBase(BaseModel):
    name: str
    source_label: str
    source_type: str = "public"
    extract_mode: str = "all"
    limit: int = 1000
    category: str | None = None


class GatherTemplateCreate(GatherTemplateBase):
    pass


class GatherTemplatePublic(GatherTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
