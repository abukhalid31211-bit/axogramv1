"""Group management tasks: join / leave / refresh via Telethon."""
from __future__ import annotations

import asyncio

from app.db.models import Account, TargetGroup
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.rotation import mark_used, pick_accounts
from app.services.settings import get_telegram_credentials
from app.services.telegram import build_client_for_account, parse_username


def groups_join_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        links = payload.get("links") or []
        account_ids = payload.get("account_ids") or []
        actor_user_id = payload.get("actor_user_id")
        links = [parse_username(link) for link in links if link.strip()]
        if not links:
            raise ValueError("أدخل رابطاً واحداً على الأقل")

        api_id, api_hash = get_telegram_credentials(db)
        accounts = []
        if account_ids:
            accounts = db.query(Account).filter(Account.id.in_(account_ids)).all()
        if not accounts:
            accounts = pick_accounts(db, "gather", count=1)
        if not accounts:
            raise ValueError("لا يوجد حساب متاح للانضمام")

        results = []
        total = len(links)
        for index, link in enumerate(links):
            jobrunner.wait_if_paused(run_id)
            done = False
            for account in accounts:
                try:
                    client = build_client_for_account(db, account, api_id, api_hash)
                    entity = asyncio.run(_join_one(client, link))
                    mark_used(db, account, "gather", 1)
                    existing = db.query(TargetGroup).filter(TargetGroup.name == link).first()
                    if not existing:
                        group_type = "public"
                        members = getattr(entity, "participants_count", 0) or 0
                        db.add(TargetGroup(name=link, group_type=group_type, members_count=members, account_id=account.id, status="active"))
                        db.commit()
                    else:
                        existing.status = "active"
                        db.add(existing)
                        db.commit()
                    results.append({"link": link, "account": account.phone, "result": "✅ تم الانضمام"})
                    done = True
                    break
                except Exception as exc:
                    last_error = str(exc)
                finally:
                    try:
                        asyncio.run(client.disconnect())
                    except Exception:
                        pass
            if not done:
                results.append({"link": link, "account": "-", "result": f"❌ {last_error[:100]}"})
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"انضمام {index + 1}/{total}: {link}")

        write_audit_log(db, action="groups.join.run", message=f"انضمام لـ {len(links)} قروب", actor_user_id=actor_user_id, entity_type="group", entity_id="batch")
        return {"results": results, "joined": sum(1 for r in results if r["result"].startswith("✅"))}
    finally:
        db.close()


async def _join_one(client, link: str):
    await client.connect()
    try:
        if link.startswith("http") or link.startswith("t.me/"):
            from telethon.tl.functions.messages import ImportChatInviteRequest

            invite_hash = link.rstrip("/").split("/")[-1]
            if invite_hash.startswith("+"):
                invite_hash = invite_hash[1:]
            try:
                return await client(ImportChatInviteRequest(invite_hash))
            except Exception:
                return await client.get_entity(link)
        return await client.get_entity(link)
    finally:
        await client.disconnect()


def groups_leave_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        group_ids = payload.get("group_ids") or []
        actor_user_id = payload.get("actor_user_id")
        groups = db.query(TargetGroup).filter(TargetGroup.id.in_(group_ids)).all() if group_ids else db.query(TargetGroup).filter(TargetGroup.status == "active").all()
        if not groups:
            raise ValueError("لا توجد قروبات للمغادرة")

        api_id, api_hash = get_telegram_credentials(db)
        results = []
        total = len(groups)
        for index, group in enumerate(groups):
            jobrunner.wait_if_paused(run_id)
            account = db.query(Account).filter(Account.id == group.account_id).first()
            if not account or not account.session_file_path:
                group.status = "left"
                db.add(group)
                db.commit()
                results.append({"group": group.name, "result": "⚠️ لا يوجد حساب مرتبط — عُدّل محلياً"})
                continue
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                await_leave(client, parse_username(group.name))
                group.status = "left"
                db.add(group)
                db.commit()
                results.append({"group": group.name, "result": "✅ تمت المغادرة"})
            except Exception as exc:
                results.append({"group": group.name, "result": f"❌ {str(exc)[:100]}"})
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"مغادرة {index + 1}/{total}: {group.name}")

        write_audit_log(db, action="groups.leave.run", message=f"مغادرة {len(groups)} قروب", actor_user_id=actor_user_id, entity_type="group", entity_id="batch")
        return {"results": results, "left": sum(1 for r in results if r["result"].startswith("✅"))}
    finally:
        db.close()


def await_leave(client, target: str) -> None:
    import asyncio

    async def _leave():
        await client.connect()
        try:
            from telethon.tl.functions.channels import LeaveChannelRequest

            entity = await client.get_entity(target)
            await client(LeaveChannelRequest(entity))
        finally:
            await client.disconnect()

    asyncio.run(_leave())


def groups_refresh_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        actor_user_id = payload.get("actor_user_id")
        groups = db.query(TargetGroup).order_by(TargetGroup.id.asc()).all()
        if not groups:
            raise ValueError("لا توجد قروبات محفوظة للتحديث")

        api_id, api_hash = get_telegram_credentials(db)
        results = []
        updated = 0
        unavailable = 0
        total = len(groups)
        for index, group in enumerate(groups):
            jobrunner.wait_if_paused(run_id)
            account = db.query(Account).filter(Account.id == group.account_id).first()
            if not account or not account.session_file_path:
                unavailable += 1
                results.append({"group": group.name, "result": "⚠️ بدون حساب مرتبط"})
                continue
            try:
                client = build_client_for_account(db, account, api_id, api_hash)
                entity = asyncio.run(_fetch_info(client, parse_username(group.name)))
                group.members_count = getattr(entity, "participants_count", 0) or group.members_count
                group.group_type = "public" if getattr(entity, "username", None) else "private"
                group.status = "active"
                db.add(group)
                db.commit()
                updated += 1
                results.append({"group": group.name, "result": f"✅ {group.members_count:,} عضو"})
            except Exception as exc:
                unavailable += 1
                results.append({"group": group.name, "result": f"⚠️ غير متاح: {str(exc)[:80]}"})
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"تحديث {index + 1}/{total}: {group.name}")

        write_audit_log(db, action="groups.refresh.run", message=f"تحديث {updated} قروب ({unavailable} غير متاح)", actor_user_id=actor_user_id, entity_type="group", entity_id="batch")
        return {"results": results, "updated": updated, "unavailable": unavailable}
    finally:
        db.close()


async def _fetch_info(client, target: str):
    await client.connect()
    try:
        return await client.get_entity(target)
    finally:
        await client.disconnect()
