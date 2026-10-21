from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "orbx_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.notification_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "dispatch-order-reminders-every-minute": {
            "task": "notifications.dispatch_order_reminders",
            "schedule": 60.0,
        },
    },
)
