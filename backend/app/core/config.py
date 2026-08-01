from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Axogram API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24

    postgres_server: str = "db"
    postgres_port: int = 5432
    postgres_user: str = "axogram"
    postgres_password: str = "axogram"
    postgres_db: str = "axogram"
    database_url: str | None = None

    redis_url: str = "redis://redis:6379/0"

    cors_origins: str = "http://localhost:5173,http://localhost,http://127.0.0.1:5173"

    first_superuser: str = "admin"
    first_superuser_password: str = "Admin123!"
    first_superuser_full_name: str = "Administrator"

    storage_root: str = "backend/storage"
    encryption_key: str | None = None

    telethon_api_id: str | None = None
    telethon_api_hash: str | None = None

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_server}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_root)


@lru_cache
def get_settings() -> Settings:
    return Settings()
