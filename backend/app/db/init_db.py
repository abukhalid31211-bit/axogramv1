from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Base
from app.db.session import SessionLocal, engine
from app.services.seed import ensure_initial_data


def init_db() -> None:
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
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
