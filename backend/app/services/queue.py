from redis import Redis
from rq import Queue

from app.core.config import get_settings

settings = get_settings()


def get_redis_connection() -> Redis:
    return Redis.from_url(settings.redis_url)


def get_default_queue() -> Queue:
    return Queue("default", connection=get_redis_connection())


def queue_available() -> bool:
    try:
        return bool(get_redis_connection().ping())
    except Exception:
        return False
