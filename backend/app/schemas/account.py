from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
    phone: str
    name: str
    username: str | None = None
    status: str = "active"
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
    proxy_id: int | None = None
    pool_id: int | None = None
    groups_count: int | None = None
    age_label: str | None = None
    last_used_label: str | None = None
    notes: str | None = None


class AccountPublic(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
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
