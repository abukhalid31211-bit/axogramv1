from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
    phone: str
    name: str
    username: str | None = None
    status: str = "active"
    proxy_id: int | None = None
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
    groups_count: int | None = None
    age_label: str | None = None
    last_used_label: str | None = None
    notes: str | None = None


class AccountPublic(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
