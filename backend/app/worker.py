from redis import Redis
from rq import Queue, Worker

from app.core.config import get_settings
from app.services.scheduler import start_scheduler_thread

settings = get_settings()


def run_worker() -> None:
    redis_conn = Redis.from_url(settings.redis_url)
    queue = Queue("default", connection=redis_conn)
    # Start the scheduler loop in a background thread (campaign schedules,
    # notifications, deletions, ban monitor).
    start_scheduler_thread()
    worker = Worker([queue], connection=redis_conn)
    worker.work()


if __name__ == "__main__":
    run_worker()
