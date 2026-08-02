from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.account import AccountPublic


class TelegramStatusResponse(BaseModel):
    configured: bool
    has_api_id: bool
    has_api_hash: bool
    sessions_path: str
    # Credentials are always owned/managed by the platform admin — subscribers
    # never enter them. Kept explicit so the UI can render the right hint.
    managed_by_admin: bool = True
    message: str | None = None


class TelegramRequestCodePayload(BaseModel):
    phone: str


class TelegramRequestCodeResponse(BaseModel):
    message: str
    phone: str
    session_path: str


class TelegramVerifyCodePayload(BaseModel):
    phone: str
    code: str | None = None
    password: str | None = None


class TelegramVerifyCodeResponse(BaseModel):
    message: str
    needs_password: bool = False
    account: AccountPublic | None = None


class TelegramAuthSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    session_file_path: str | None = None
    status: str
    needs_password: bool
    error_message: str | None = None
    account_id: int | None = None
    created_at: datetime
    updated_at: datetime
