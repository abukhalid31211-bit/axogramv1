from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AccountValidationRow(BaseModel):
    account_id: int
    phone: str
    name: str
    status: str
    reason: str
    last_checked: str


class AccountValidationResult(BaseModel):
    summary: dict[str, int]
    rows: list[AccountValidationRow]
    generated_at: str


class WarmupStep(BaseModel):
    phone: str
    action: str
    result: str


class WarmupResult(BaseModel):
    summary: dict[str, Any]
    steps: list[WarmupStep]
    generated_at: str


class ValidateAccountsJobPayload(BaseModel):
    account_ids: list[int] | None = None
    run_inline: bool = False


class WarmupAccountsJobPayload(BaseModel):
    account_ids: list[int] | None = None
    days: int = 7
    intensity: str = "medium"
    run_inline: bool = False


class JobStartResponse(BaseModel):
    mode: str
    message: str
    job_id: str | None = None
    result: dict[str, Any] | None = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None
    enqueued_at: datetime | None = None
    ended_at: datetime | None = None


class JobRunPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    label: str
    status: str
    control: str
    progress: int
    current_step: str | None = None
    progress_json: str | None = None
    result_json: str | None = None
    error: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    created_by: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    updated_at: datetime
