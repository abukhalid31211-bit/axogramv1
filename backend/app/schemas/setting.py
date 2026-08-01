from datetime import datetime

from pydantic import BaseModel


class SettingPublic(BaseModel):
    key: str
    value: str | None
    is_secret: bool
    description: str | None = None
    updated_at: datetime


class SettingInput(BaseModel):
    key: str
    value: str
    is_secret: bool = False
    description: str | None = None


class SettingBatchUpdate(BaseModel):
    items: list[SettingInput]
