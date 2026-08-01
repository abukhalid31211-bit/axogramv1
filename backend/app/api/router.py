from fastapi import APIRouter

from app.api.routes import (
    accounts,
    add,
    admin,
    auth,
    campaigns,
    gather,
    health,
    jobs,
    proxies,
    reports,
    rotation,
    security,
    groups,
    notifications,
    settings,
    system,
    telegram,
    uploads,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(accounts.router)
api_router.include_router(add.router)
api_router.include_router(proxies.router)
api_router.include_router(settings.router)
api_router.include_router(groups.router)
api_router.include_router(notifications.router)
api_router.include_router(reports.router)
api_router.include_router(jobs.router)
api_router.include_router(gather.router)
api_router.include_router(telegram.router)
api_router.include_router(uploads.router)
api_router.include_router(campaigns.router)
api_router.include_router(rotation.router)
api_router.include_router(security.router)
api_router.include_router(system.router)
api_router.include_router(admin.router)
