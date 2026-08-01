from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import DbSession, get_current_active_user
from app.core.config import get_settings
from app.db.models import UploadFileRecord, User
from app.schemas.upload import UploadFilePublic
from app.services.audit import write_audit_log

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()


@router.get("", response_model=list[UploadFilePublic])
def list_uploads(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]) -> list[UploadFilePublic]:
    rows = db.query(UploadFileRecord).order_by(UploadFileRecord.created_at.desc()).all()
    return [UploadFilePublic.model_validate(row) for row in rows]


@router.post("", response_model=UploadFilePublic)
async def create_upload(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
    category: str = Form(default="csv"),
) -> UploadFilePublic:
    uploads_dir = settings.storage_path / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "file").suffix
    stored_name = f"{uuid4().hex}{suffix}"
    target = uploads_dir / stored_name
    content = await file.read()
    target.write_bytes(content)

    row = UploadFileRecord(
        category=category,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        stored_path=str(target),
        mime_type=file.content_type,
        size=len(content),
        uploaded_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit_log(db, action="uploads.create", message=f"Uploaded file {row.original_name}", actor_user_id=current_user.id, entity_type="upload", entity_id=str(row.id))
    return UploadFilePublic.model_validate(row)


@router.get("/{upload_id}/download")
def download_upload(upload_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    row = db.query(UploadFileRecord).filter(UploadFileRecord.id == upload_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(path=row.stored_path, filename=row.original_name)
