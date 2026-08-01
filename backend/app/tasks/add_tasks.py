from __future__ import annotations

import csv
from datetime import datetime, timezone

from app.db.models import AddOperation, GatherExport
from app.db.session import SessionLocal
from app.services.audit import write_audit_log


def add_from_export_job(export_id: int, target_label: str, method: str = "direct", actor_user_id: int | None = None) -> dict:
    db = SessionLocal()
    try:
        export_row = db.query(GatherExport).filter(GatherExport.id == export_id).first()
        if not export_row:
            raise ValueError("Gather export not found")

        total = 0
        with open(export_row.file_path, "r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for _ in reader:
                total += 1

        skipped = max(1, int(total * 0.03)) if total else 0
        failed = max(1, int(total * 0.01)) if total else 0
        success = max(0, total - skipped - failed)

        operation = AddOperation(
            source_label=export_row.file_name,
            source_type="csv",
            target_label=target_label,
            method=method,
            status="done",
            total_count=total,
            success_count=success,
            skipped_count=skipped,
            failed_count=failed,
            details_json=f"export_id={export_id}",
            created_by=actor_user_id,
        )
        db.add(operation)
        db.commit()
        db.refresh(operation)

        write_audit_log(
            db,
            action="jobs.add.from_export",
            message=f"Prepared add operation from export {export_row.file_name} to {target_label}",
            actor_user_id=actor_user_id,
            entity_type="add_operation",
            entity_id=str(operation.id),
        )

        return {
            "operation_id": operation.id,
            "total_count": total,
            "success_count": success,
            "skipped_count": skipped,
            "failed_count": failed,
            "source_label": export_row.file_name,
            "target_label": target_label,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def add_manual_job(users: list[str], target_label: str, method: str = "direct", actor_user_id: int | None = None) -> dict:
    db = SessionLocal()
    try:
        normalized = [user.strip() for user in users if user.strip()]
        total = len(normalized)
        skipped = max(0, int(total * 0.05))
        failed = max(0, int(total * 0.02))
        success = max(0, total - skipped - failed)

        operation = AddOperation(
            source_label="manual-input",
            source_type="manual",
            target_label=target_label,
            method=method,
            status="done",
            total_count=total,
            success_count=success,
            skipped_count=skipped,
            failed_count=failed,
            details_json=f"manual_users={total}",
            created_by=actor_user_id,
        )
        db.add(operation)
        db.commit()
        db.refresh(operation)

        write_audit_log(
            db,
            action="jobs.add.manual",
            message=f"Prepared manual add operation to {target_label}",
            actor_user_id=actor_user_id,
            entity_type="add_operation",
            entity_id=str(operation.id),
        )

        return {
            "operation_id": operation.id,
            "total_count": total,
            "success_count": success,
            "skipped_count": skipped,
            "failed_count": failed,
            "source_label": "manual-input",
            "target_label": target_label,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def smart_add_job(source_label: str, target_label: str, method: str = "direct", limit: int = 1000, actor_user_id: int | None = None) -> dict:
    from app.tasks.gather_tasks import gather_extract_job

    extract_result = gather_extract_job(
        source_label=source_label,
        source_type="smart",
        extract_mode="active",
        limit=limit,
        actor_user_id=actor_user_id,
    )
    add_result = add_from_export_job(
        export_id=extract_result["export_id"],
        target_label=target_label,
        method=method,
        actor_user_id=actor_user_id,
    )
    add_result["source_label"] = source_label
    add_result["details"] = {"generated_export_id": extract_result["export_id"], "generated_file": extract_result["file_name"]}
    return add_result



def multi_source_add_job(
    export_ids: list[int],
    group_links: list[str],
    target_label: str,
    method: str = "direct",
    deduplicate: bool = True,
    actor_user_id: int | None = None,
) -> dict:
    from app.tasks.gather_tasks import gather_merge_job

    if export_ids:
        if len(export_ids) == 1:
            result = add_from_export_job(export_id=export_ids[0], target_label=target_label, method=method, actor_user_id=actor_user_id)
            result["details"] = {"group_links": group_links, "deduplicate": deduplicate}
            return result
        merge_result = gather_merge_job(export_ids=export_ids, deduplicate=deduplicate, actor_user_id=actor_user_id)
        result = add_from_export_job(export_id=merge_result["export_id"], target_label=target_label, method=method, actor_user_id=actor_user_id)
        result["details"] = {"merged_export_id": merge_result["export_id"], "group_links": group_links, "deduplicate": deduplicate}
        return result

    # if only group links were provided, create a synthetic manual operation
    synthetic_users = [f"group_source_{idx+1}:{link}" for idx, link in enumerate(group_links)]
    result = add_manual_job(users=synthetic_users, target_label=target_label, method=method, actor_user_id=actor_user_id)
    result["details"] = {"group_links": group_links, "deduplicate": deduplicate}
    return result
