"""Celery tasks for Web Push delivery.

Delivery is optional until WEB_PUSH_VAPID_* settings and pywebpush are configured.
"""
import asyncio
import logging
import re
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.notification import Notification, NotificationPreference, NotificationSubscription
from app.models.order import Order, OrderReminderDispatch
from app.models.base import generate_uuid
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _send_web_push(subscription_id: str, payload: dict) -> None:
    async with AsyncSessionLocal() as db:
        subscription = (await db.execute(
            select(NotificationSubscription).where(
                NotificationSubscription.id == subscription_id,
                NotificationSubscription.revoked_at.is_(None),
            )
        )).scalar_one_or_none()
        if subscription is None:
            return
        membership = (await db.execute(select(CompanyMembership).where(
            CompanyMembership.company_id == subscription.company_id,
            CompanyMembership.user_id == subscription.user_id,
            CompanyMembership.status == "active",
        ))).scalar_one_or_none()
        if membership is None:
            subscription.revoked_at = datetime.now(timezone.utc)
            await db.commit()
            return
        try:
            from pywebpush import WebPushException, webpush
            webpush(
                subscription_info={"endpoint": subscription.endpoint, "keys": {
                    "p256dh": subscription.p256dh_key, "auth": subscription.auth_key,
                }},
                data=__import__("json").dumps(payload),
                vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
            )
            subscription.last_used_at = datetime.now(timezone.utc)
            await db.commit()
        except ImportError:
            raise RuntimeError("pywebpush must be installed to send Web Push notifications")
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                subscription.revoked_at = datetime.now(timezone.utc)
                await db.commit()
            else:
                raise


@celery_app.task(
    name="notifications.send_web_push",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
)
def send_web_push(subscription_id: str, payload: dict) -> None:
    """Send a Web Push payload after revalidating the recipient's active membership."""
    asyncio.run(_send_web_push(subscription_id, payload))


def _recurrence_days(value: str) -> int:
    if value == "daily":
        return 1
    if value == "weekly":
        return 7
    match = re.fullmatch(r"every_(\d+)_days", value)
    if match is None:
        raise ValueError(f"Unsupported reminder recurrence: {value}")
    days = int(match.group(1))
    if not 1 <= days <= 365:
        raise ValueError(f"Unsupported reminder recurrence: {value}")
    return days


def _priority_schedule(reminder: dict, priority: str) -> tuple[int, int]:
    prefix = priority if priority in {"high", "normal", "low"} else "normal"
    lead_days = int(reminder.get(f"{prefix}_priority_days", 10))
    interval_days = _recurrence_days(reminder.get(f"{prefix}_priority_recurring", "daily"))
    return lead_days, interval_days


async def _dispatch_due_order_reminders(db, now: datetime) -> int:
    """Create one tenant-scoped reminder per eligible user, order, and local date."""
    now_utc = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)
    companies = (await db.execute(select(Company))).scalars().all()
    dispatch_count = 0

    for company in companies:
        reminder = company.reminder_settings
        if not reminder.get("enabled", True):
            continue
        timezone_name = reminder.get("timezone") or "UTC"
        try:
            local_timezone = ZoneInfo(timezone_name)
        except (ValueError, ZoneInfoNotFoundError):
            logger.error(
                "Skipping order reminders for company %s because timezone %r is invalid",
                company.id,
                timezone_name,
            )
            continue
        try:
            trigger_time = time.fromisoformat(reminder.get("trigger_time", "09:00"))
        except ValueError:
            logger.error(
                "Skipping order reminders for company %s because trigger time is invalid",
                company.id,
            )
            continue

        local_now = now_utc.astimezone(local_timezone)
        if (local_now.hour, local_now.minute) != (trigger_time.hour, trigger_time.minute):
            continue
        scheduled_date = local_now.date()
        order_result = await db.execute(
            select(Order)
            .where(
                Order.company_id == company.id,
                Order.due_date.is_not(None),
                Order.status.not_in({"delivered", "cancelled"}),
            )
        )
        orders = order_result.scalars().all()
        if not orders:
            continue

        membership_result = await db.execute(
            select(CompanyMembership).where(
                CompanyMembership.company_id == company.id,
                CompanyMembership.status == "active",
            )
        )
        memberships = membership_result.scalars().all()
        if not memberships:
            continue
        user_ids = [membership.user_id for membership in memberships]

        preference_result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.company_id == company.id,
                NotificationPreference.user_id.in_(user_ids),
            )
        )
        preferences = {item.user_id: item for item in preference_result.scalars().all()}
        subscription_result = await db.execute(
            select(NotificationSubscription).where(
                NotificationSubscription.company_id == company.id,
                NotificationSubscription.user_id.in_(user_ids),
                NotificationSubscription.revoked_at.is_(None),
            )
        )
        subscriptions: dict[str, list[NotificationSubscription]] = {}
        for subscription in subscription_result.scalars().all():
            subscriptions.setdefault(subscription.user_id, []).append(subscription)

        dialect_name = db.get_bind().dialect.name
        if dialect_name == "sqlite":
            insert = sqlite_insert
        elif dialect_name == "postgresql":
            insert = postgres_insert
        else:
            raise RuntimeError(f"Order reminders do not support database dialect {dialect_name}")
        queued_pushes: list[tuple[str, dict]] = []
        for order in orders:
            due_date = order.due_date
            if due_date is None:
                continue
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)
            days_until_due = (due_date.astimezone(local_timezone).date() - scheduled_date).days
            try:
                lead_days, interval_days = _priority_schedule(reminder, order.priority)
            except (TypeError, ValueError):
                logger.exception(
                    "Skipping order %s because its reminder schedule is invalid",
                    order.id,
                )
                continue
            reminder_day_offset = lead_days - days_until_due
            if (
                days_until_due < 0
                or days_until_due > lead_days
                or reminder_day_offset % interval_days != 0
            ):
                continue

            for membership in memberships:
                preference = preferences.get(membership.user_id)
                type_preferences = preference.type_preferences if preference else {}
                if type_preferences and not type_preferences.get("order_reminder", True):
                    continue
                in_app_enabled = preference is None or preference.in_app_enabled
                web_push_enabled = (
                    (preference is None or preference.web_push_enabled)
                    and bool(settings.WEB_PUSH_VAPID_PRIVATE_KEY)
                )
                recipient_subscriptions = subscriptions.get(membership.user_id, []) if web_push_enabled else []
                if not in_app_enabled and not recipient_subscriptions:
                    continue

                dispatch = insert(OrderReminderDispatch).values(
                    id=generate_uuid(),
                    company_id=company.id,
                    order_id=order.id,
                    recipient_id=membership.user_id,
                    scheduled_date=scheduled_date,
                    created_at=now_utc,
                    updated_at=now_utc,
                ).on_conflict_do_nothing(
                    index_elements=["order_id", "recipient_id", "scheduled_date"]
                ).returning(OrderReminderDispatch.id)
                created_id = (await db.execute(dispatch)).scalar_one_or_none()
                if created_id is None:
                    continue

                link = f"/workspace/orders?section=orders&order_id={order.id}"
                title = f"{order.priority.title()} priority order due soon"
                body = f"Order {order.order_number} for {order.customer.name} is due in {days_until_due} day(s)."
                if in_app_enabled:
                    db.add(Notification(
                        company_id=company.id,
                        recipient_id=membership.user_id,
                        type="order_reminder",
                        title=title,
                        body=body,
                        link=link,
                    ))
                for subscription in recipient_subscriptions:
                    queued_pushes.append((
                        subscription.id,
                        {
                            "title": title,
                            "body": body,
                            "url": link,
                            "tag": f"order-reminder-{order.id}",
                        },
                    ))
                dispatch_count += 1

        await db.commit()
        for subscription_id, payload in queued_pushes:
            try:
                send_web_push.delay(subscription_id, payload)
            except Exception:
                logger.exception(
                    "Could not queue order reminder push for company %s",
                    company.id,
                )

    return dispatch_count


@celery_app.task(name="notifications.dispatch_order_reminders")
def dispatch_order_reminders() -> int:
    """Dispatch due reminders on the minute configured by each company."""
    async def run() -> int:
        async with AsyncSessionLocal() as db:
            return await _dispatch_due_order_reminders(db, datetime.now(timezone.utc))

    return asyncio.run(run())
