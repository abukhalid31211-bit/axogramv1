from pathlib import Path

from telethon import TelegramClient

from app.core.config import get_settings

settings = get_settings()


def phone_to_session_path(phone: str) -> Path:
    safe_phone = phone.replace("+", "plus_").replace("/", "_").replace("\\", "_").replace(" ", "")
    sessions_dir = settings.storage_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    return sessions_dir / f"{safe_phone}.session"


def build_client(phone: str, api_id: int, api_hash: str) -> TelegramClient:
    session_path = phone_to_session_path(phone)
    return TelegramClient(str(session_path), api_id, api_hash)


def build_client_from_session_path(session_path: str | Path, api_id: int, api_hash: str) -> TelegramClient:
    return TelegramClient(str(session_path), api_id, api_hash)
