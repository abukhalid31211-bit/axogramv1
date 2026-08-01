from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/system")
def system_info() -> dict[str, str]:
    import platform
    import sys
    return {
        "version": "1.0.0",
        "release_date": "2026-06-01",
        "python": sys.version.split()[0],
        "telethon": "1.40.0",
        "database": "PostgreSQL",
        "os": platform.system() + " " + platform.release(),
        "cpu": "38%",
        "ram": "62%",
        "storage": "48%",
        "uptime": "3 أيام 7 ساعات",
        "server_address": "203.0.113.5",
    }
