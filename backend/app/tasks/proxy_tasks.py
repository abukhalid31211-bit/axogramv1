"""Real proxy validation using TCP/SOCKS/HTTP CONNECT checks."""
from __future__ import annotations

import asyncio
import socket
import time
from datetime import datetime, timezone

from app.db.models import Proxy
from app.db.session import SessionLocal
from app.services import jobrunner
from app.services.audit import write_audit_log
from app.services.notify import notify

CHECK_TIMEOUT = 10
TARGET_HOST = "api.telegram.org"
TARGET_PORT = 443


def _socks_check(proxy_type: str, host: str, port: int, auth: tuple | None, timeout: float) -> tuple[bool, float | None, str]:
    import socks as sockslib

    sock = sockslib.socksocket()
    sock.settimeout(timeout)
    proto = sockslib.SOCKS5 if proxy_type == "SOCKS5" else sockslib.SOCKS4
    if auth and proxy_type == "SOCKS5":
        sock.set_proxy(proto, host, port, username=auth[0], password=auth[1])
    else:
        sock.set_proxy(proto, host, port)
    start = time.monotonic()
    try:
        sock.connect((TARGET_HOST, TARGET_PORT))
        elapsed = (time.monotonic() - start) * 1000
        return True, round(elapsed, 1), ""
    except Exception as exc:
        return False, None, str(exc)
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _http_check(host: str, port: int, auth: tuple | None, timeout: float) -> tuple[bool, float | None, str]:
    import base64

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    start = time.monotonic()
    try:
        sock.connect((host, port))
        request = f"CONNECT {TARGET_HOST}:{TARGET_PORT} HTTP/1.1\r\nHost: {TARGET_HOST}:{TARGET_PORT}\r\n"
        if auth:
            token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
            request += f"Proxy-Authorization: Basic {token}\r\n"
        request += "\r\n"
        sock.sendall(request.encode())
        response = b""
        while b"\r\n\r\n" not in response:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
        elapsed = (time.monotonic() - start) * 1000
        if response.startswith(b"HTTP/1.1 200") or response.startswith(b"HTTP/1.0 200"):
            return True, round(elapsed, 1), ""
        return False, None, response.decode(errors="replace").split("\r\n")[0]
    except Exception as exc:
        return False, None, str(exc)
    finally:
        try:
            sock.close()
        except Exception:
            pass


async def check_proxy_async(proxy: Proxy) -> dict:
    host, port_raw = proxy.address.rsplit(":", 1)
    try:
        port = int(port_raw)
    except ValueError:
        return {"id": proxy.id, "address": proxy.address, "ok": False, "speed_ms": None, "error": "منفذ غير صالح"}
    auth = (proxy.auth_login, proxy.auth_password) if proxy.auth_login else None
    ptype = (proxy.proxy_type or "SOCKS5").upper()
    try:
        if ptype in ("HTTP", "HTTPS"):
            ok, speed, err = await asyncio.to_thread(_http_check, host, port, auth, CHECK_TIMEOUT)
        else:
            ok, speed, err = await asyncio.to_thread(_socks_check, ptype, host, port, auth, CHECK_TIMEOUT)
        return {"id": proxy.id, "address": proxy.address, "ok": ok, "speed_ms": speed, "error": err}
    except Exception as exc:
        return {"id": proxy.id, "address": proxy.address, "ok": False, "speed_ms": None, "error": str(exc)}


def validate_proxies_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        proxy_ids = payload.get("proxy_ids") or []
        query = db.query(Proxy)
        if proxy_ids:
            query = query.filter(Proxy.id.in_(proxy_ids))
        proxies = query.order_by(Proxy.id.asc()).all()
        total = len(proxies)
        if total == 0:
            raise ValueError("لا توجد بروكسيهات للفحص")
        jobrunner.update_progress(run_id, 1, "جاري فحص البروكسيهات...")

        results = []
        ok_count = dead_count = slow_count = 0
        for index, proxy in enumerate(proxies):
            jobrunner.wait_if_paused(run_id)
            result = asyncio.run(check_proxy_async(proxy))
            results.append(result)
            if result["ok"]:
                if result["speed_ms"] and result["speed_ms"] > 800:
                    proxy.status = "slow"
                    slow_count += 1
                else:
                    proxy.status = "active"
                    ok_count += 1
                proxy.speed_ms = result["speed_ms"]
                proxy.notes = f"آخر فحص: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
            else:
                proxy.status = "dead"
                proxy.notes = f"فشل الفحص: {result['error'][:120]}"
                dead_count += 1
            db.add(proxy)
            db.commit()
            jobrunner.update_progress(run_id, int((index + 1) / total * 100), f"فحص {index + 1}/{total}: {proxy.address}")

        write_audit_log(
            db,
            action="proxies.validate.run",
            message=f"فحص {total} بروكسي: {ok_count} نشط، {slow_count} بطيء، {dead_count} ميت",
            actor_user_id=payload.get("actor_user_id"),
            entity_type="proxy",
            entity_id="batch",
        )
        notify(
            db,
            event_type="proxies.validated",
            level="info",
            title="اكتمل فحص البروكسيهات",
            message=f"تم فحص {total} بروكسي — ✅ {ok_count} نشط | 🐢 {slow_count} بطيء | ❌ {dead_count} ميت",
        )
        return {
            "summary": {"total": total, "active": ok_count, "slow": slow_count, "dead": dead_count},
            "results": results,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def replace_dead_run(run_id: str, payload: dict) -> dict:
    db = SessionLocal()
    try:
        candidates_raw = payload.get("candidates") or []
        dead = db.query(Proxy).filter(Proxy.status == "dead").all()
        replaced = 0
        checked = 0
        errors: list[str] = []
        candidate_objs: list[Proxy] = []

        # Parse candidate lines (address[:type[:login:password]])
        for line in candidates_raw:
            line = line.strip()
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 2:
                address = f"{parts[0]}:{parts[1]}"
                ptype = "SOCKS5"
                login = password = None
                if len(parts) >= 4:
                    login, password = parts[2], parts[3]
                elif len(parts) == 3:
                    ptype = parts[2].upper()
                existing = db.query(Proxy).filter(Proxy.address == address).first()
                if existing:
                    continue
                candidate_objs.append(Proxy(address=address, proxy_type=ptype, status="dead", auth_login=login, auth_password=password))

        total = len(dead) + len(candidate_objs)
        if total == 0:
            return {"replaced": 0, "checked": 0, "remaining_without": 0, "message": "لا توجد بروكسيهات ميتة ولا مرشحون"}

        jobrunner.update_progress(run_id, 2, "جاري استبدال البروكسيهات الميتة...")
        idx = 0
        for proxy in dead + candidate_objs:
            idx += 1
            jobrunner.wait_if_paused(run_id)
            result = asyncio.run(check_proxy_async(proxy))
            checked += 1
            if result["ok"] and dead and not candidate_objs:
                proxy.status = "active"
                proxy.speed_ms = result["speed_ms"]
                replaced += 1
            elif result["ok"] and candidate_objs:
                # replace a dead proxy with this candidate
                if dead:
                    dead_proxy = dead.pop(0)
                    dead_proxy.status = "dead"
                    db.add(dead_proxy)
                proxy.status = "active"
                proxy.speed_ms = result["speed_ms"]
                replaced += 1
                db.add(proxy)
            elif candidate_objs:
                errors.append(f"{proxy.address}: {result['error'][:80]}")
            else:
                proxy.notes = f"فشل الفحص: {result['error'][:120]}"
            db.add(proxy)
            db.commit()
            jobrunner.update_progress(run_id, int(idx / total * 100), f"فحص {idx}/{total}")

        remaining_without = db.query(Proxy).filter(Proxy.status == "dead").count()
        write_audit_log(
            db,
            action="proxies.replace_dead.run",
            message=f"استبدال البروكسيهات الميتة: تم استبدال {replaced} من أصل {checked} تم فحصها",
            actor_user_id=payload.get("actor_user_id"),
            entity_type="proxy",
            entity_id="batch",
        )
        return {
            "replaced": replaced,
            "checked": checked,
            "remaining_without": remaining_without,
            "errors": errors[:20],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()
