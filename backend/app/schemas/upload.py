from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UploadFilePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    original_name: str
    stored_name: str
    stored_path: str
    mime_type: str | None = None
    size: int
    uploaded_by: int | None = None
    created_at: datetime
