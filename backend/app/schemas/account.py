from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
    phone: str
    name: str
    username: str | None = None
    status: str = "active"
    classification: str = "multi"
    proxy_id: int | None = None
    pool_id: int | None = None
    groups_count: int = 0
    age_label: str | None = None
    last_used_label: str | None = None
    notes: str | None = None
    session_file_path: str | None = None
    telegram_user_id: str | None = None


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    phone: str | None = None
    name: str | None = None
    username: str | None = None
    status: str | None = None
    classification: str | None = None
    proxy_id: int | None = None
    pool_id: int | None = None
    groups_count: int | None = None
    age_label: str | None = None
    last_used_label: str | None = None
    notes: str | None = None


class AccountPublic(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    health_score: int = 50
    gather_count: int = 0
    add_count: int = 0
    dm_count: int = 0
    flood_waits_count: int = 0
    telegram_created_at: str | None = None
    data_center: str | None = None
    device_model: str | None = None
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AccountPoolBase(BaseModel):
    name: str
    description: str | None = None
    purpose: str = "multi"


class AccountPoolCreate(AccountPoolBase):
    pass


class AccountPoolUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    purpose: str | None = None


class AccountPoolPublic(AccountPoolBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class AccountPoolDetail(AccountPoolPublic):
    accounts: list[AccountPublic] = []


class SessionImportStringPayload(BaseModel):
    sessions: list[str]


class SessionImportTextPayload(BaseModel):
    content: str


class SessionImportZipPayload(BaseModel):
    zip_path: str
    password: str | None = None


class SessionImportFilesPayload(BaseModel):
    paths: list[str]


class ProfileUpdatePayload(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    username: str | None = None


class BulkProfilePayload(BaseModel):
    account_ids: list[int] | None = None
    names_file: str | None = None
    bios_file: str | None = None
    photos_dir: str | None = None


class AccountSettingsPayload(BaseModel):
    gather_limit: int | None = None
    add_limit: int | None = None
    dm_limit: int | None = None
    delay_min: int | None = None
    delay_max: int | None = None
    priority: str | None = None  # high/mid/low
    allow_gather: bool | None = None
    allow_add: bool | None = None
    allow_dm: bool | None = None
    allow_campaign: bool | None = None
    allow_rotation: bool | None = None
    limit_work_hours: bool | None = None
    work_hours_from: str | None = None
    work_hours_to: str | None = None
