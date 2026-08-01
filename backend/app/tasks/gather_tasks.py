from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from telethon.tl.types import UserStatusLastMonth, UserStatusLastWeek, UserStatusOnline, UserStatusRecently

from app.core.config import get_settings
from app.db.models import Account, GatherExport
from app.db.session import SessionLocal
from app.services.audit import write_audit_log
from app.services.settings import get_telegram_credentials
from app.services.telegram_auth import build_client_from_session_path

settings = get_settings()


def _exports_dir() -> Path:
    path = settings.storage_path / "exports"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write_csv(file_path: Path, rows: list[dict[str, str]]) -> None:
    with file_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["user_id", "first_name", "username", "phone", "last_seen"])
        writer.writeheader()
        writer.writerows(rows)


def _synthetic_rows(limit: int) -> list[dict[str, str]]:
    member_count = max(50, min(limit, 10000))
    rows = []
    for index in range(1, member_count + 1):
        rows.append(
            {
                "user_id": str(100000 + index),
                "first_name": f"Member {index}",
                "username": f"user_{index}",
                "phone": f"+966500{index:06d}",
                "last_seen": datetime.now(timezone.utc).date().isoformat(),
            }
        )
    return rows


async def _telethon_extract_rows(session_path: str, api_id: int, api_hash: str, source_label: str, extract_mode: str, limit: int) -> list[dict[str, str]]:
    client = build_client_from_session_path(session_path, api_id, api_hash)
    rows: list[dict[str, str]] = []
    try:
        await client.connect()
        if not await client.is_user_authorized():
            raise ValueError("Session is not authorized")

        entity = await client.get_entity(source_label)
        async for user in client.iter_participants(entity, limit=max(1, limit)):
            if extract_mode == "bots" and not getattr(user, "bot", False):
                continue
            if extract_mode == "online" and not isinstance(getattr(user, "status", None), UserStatusOnline):
                continue
            if extract_mode == "active" and not isinstance(getattr(user, "status", None), (UserStatusOnline, UserStatusRecently, UserStatusLastWeek, UserStatusLastMonth)):
                continue

            username = f"@{user.username}" if getattr(user, "username", None) else ""
            phone = f"+{user.phone}" if getattr(user, "phone", None) else ""
            last_seen = type(getattr(user, "status", None)).__name__ if getattr(user, "status", None) else "unknown"
            first_name = " ".join(part for part in [getattr(user, "first_name", None), getattr(user, "last_name", None)] if part).strip() or "Unknown"
            rows.append(
                {
                    "user_id": str(user.id),
                    "first_name": first_name,
                    "username": username,
                    "phone": phone,
                    "last_seen": last_seen,
                }
            )
            if len(rows) >= limit:
                break
    finally:
        await client.disconnect()

    return rows


def gather_extract_job(
    source_label: str,
    source_type: str = "public",
    extract_mode: str = "all",
    limit: int = 1000,
    account_id: int | None = None,
    actor_user_id: int | None = None,
) -> dict:
    db = SessionLocal()
    try:
        execution_mode = "synthetic"
        warning: str | None = None
        rows: list[dict[str, str]]

        if account_id:
            account = db.query(Account).filter(Account.id == account_id).first()
            if not account:
                raise ValueError("Selected account not found")
            if not account.session_file_path:
                raise ValueError("Selected account does not have a saved Telegram session")
            session_path = Path(account.session_file_path)
            if not session_path.exists():
                raise ValueError("Saved Telegram session file does not exist on disk")

            api_id, api_hash = get_telegram_credentials(db)
            try:
                rows = asyncio.run(_telethon_extract_rows(str(session_path), api_id, api_hash, source_label, extract_mode, max(1, limit)))
                execution_mode = "telethon"
            except Exception as exc:
                rows = _synthetic_rows(limit)
                execution_mode = "synthetic-fallback"
                warning = f"Telethon gather failed, fallback used: {exc}"
        else:
            rows = _synthetic_rows(limit)
            warning = "No account session selected; synthetic fallback used"

        safe_name = source_label.replace("@", "").replace("/", "_").replace(" ", "_") or "gather"
        file_name = f"gather_{safe_name}_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, rows)

        export_row = GatherExport(
            source_label=source_label,
            source_type=source_type,
            file_name=file_name,
            file_path=str(file_path),
            member_count=len(rows),
            status="ready",
            notes=f"extract_mode={extract_mode}; execution_mode={execution_mode}; warning={warning or ''}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)

        write_audit_log(
            db,
            action="jobs.gather.extract",
            message=f"Generated gather export {file_name} from {source_label}",
            actor_user_id=actor_user_id,
            entity_type="gather_export",
            entity_id=str(export_row.id),
        )

        return {
            "export_id": export_row.id,
            "file_name": file_name,
            "member_count": len(rows),
            "source_label": source_label,
            "execution_mode": execution_mode,
            "warning": warning,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def gather_merge_job(export_ids: list[int], deduplicate: bool = True, actor_user_id: int | None = None) -> dict:
    db = SessionLocal()
    try:
        exports = db.query(GatherExport).filter(GatherExport.id.in_(export_ids)).order_by(GatherExport.id.asc()).all()
        if len(exports) < 2:
            raise ValueError("At least two exports are required for merge")

        merged_rows: list[dict[str, str]] = []
        seen_ids: set[str] = set()

        for export in exports:
            with Path(export.file_path).open("r", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    if deduplicate:
                        if row["user_id"] in seen_ids:
                            continue
                        seen_ids.add(row["user_id"])
                    merged_rows.append(dict(row))

        file_name = f"merged_{uuid4().hex[:8]}.csv"
        file_path = _exports_dir() / file_name
        _write_csv(file_path, merged_rows)

        export_row = GatherExport(
            source_label="merge",
            source_type="merge",
            file_name=file_name,
            file_path=str(file_path),
            member_count=len(merged_rows),
            status="ready",
            notes=f"inputs={','.join(str(item.id) for item in exports)}",
            created_by=actor_user_id,
        )
        db.add(export_row)
        db.commit()
        db.refresh(export_row)

        write_audit_log(
            db,
            action="jobs.gather.merge",
            message=f"Merged {len(exports)} exports into {file_name}",
            actor_user_id=actor_user_id,
            entity_type="gather_export",
            entity_id=str(export_row.id),
        )
        return {
            "export_id": export_row.id,
            "file_name": file_name,
            "input_count": len(exports),
            "member_count": len(merged_rows),
            "deduplicated": deduplicate,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()
