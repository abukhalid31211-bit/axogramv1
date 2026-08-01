from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Base
from app.db.session import SessionLocal, engine
from app.services.seed import ensure_initial_data

# Columns added after the initial schema — applied safely on existing databases.
ADD_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "accounts": [
        ("pool_id", "INTEGER REFERENCES account_pools(id) ON DELETE SET NULL"),
        ("last_used_at", "TIMESTAMPTZ"),
    ],
    "campaigns": [
        ("message_text", "TEXT"),
        ("message_kind", "VARCHAR(20) DEFAULT 'text'"),
        ("groups_json", "TEXT"),
        ("recipients_json", "TEXT"),
        ("settings_json", "TEXT"),
        ("delete_after_hours", "INTEGER"),
        ("auto_leave_new_groups", "BOOLEAN DEFAULT FALSE"),
        ("account_ids_json", "TEXT"),
        ("started_at", "TIMESTAMPTZ"),
        ("finished_at", "TIMESTAMPTZ"),
        ("last_error", "TEXT"),
    ],
}


def _apply_migrations() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    for table_name, columns in ADD_COLUMNS.items():
        if table_name not in existing_tables:
            continue
        existing_columns = {col["name"] for col in inspector.get_columns(table_name)}
        missing = [col for col in columns if col[0] not in existing_columns]
        if not missing:
            continue
        with engine.begin() as conn:
            for col_name, col_def in missing:
                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN {col_name} {col_def}'))
        inspector = inspect(engine)


def init_db() -> None:
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    _apply_migrations()
    db: Session = SessionLocal()
    try:
        ensure_initial_data(
            db,
            superuser_username=settings.first_superuser,
            superuser_password=settings.first_superuser_password,
            superuser_full_name=settings.first_superuser_full_name,
        )
    finally:
        db.close()
