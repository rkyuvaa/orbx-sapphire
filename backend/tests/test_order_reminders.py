from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.models.membership import CompanyMembership
from app.models.notification import Notification, NotificationSubscription
from app.models.order import Customer, Order, OrderReminderDispatch
from app.tasks.notification_tasks import _dispatch_due_order_reminders, send_web_push


async def auth_headers(
    client: AsyncClient,
    email: str,
    company_id: str,
    password: str = "OwnerPass123!",
) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "X-Company-ID": company_id,
    }


@pytest.mark.asyncio
async def test_reminder_settings_are_company_scoped_and_owner_editable(
    client: AsyncClient, seed_data
):
    company_a_headers = await auth_headers(
        client, "owner1@company-a.com", seed_data["comp1"].id
    )
    defaults = await client.get(
        "/api/v1/companies/current/reminder-settings",
        headers=company_a_headers,
    )
    assert defaults.status_code == 200
    assert defaults.json()["high_priority_days"] == 15
    assert defaults.json()["normal_priority_recurring"] == "every_2_days"
    assert defaults.json()["low_priority_days"] == 5
    assert defaults.json()["trigger_time"] == "09:00"

    updated = await client.patch(
        "/api/v1/companies/current/reminder-settings",
        headers=company_a_headers,
        json={
            "high_priority_days": 21,
            "normal_priority_recurring": "every_3_days",
            "trigger_time": "13:45",
            "timezone": "Asia/Kolkata",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["high_priority_days"] == 21
    assert updated.json()["normal_priority_recurring"] == "every_3_days"
    assert updated.json()["trigger_time"] == "13:45"
    assert updated.json()["timezone"] == "Asia/Kolkata"

    company_b_headers = await auth_headers(
        client, "owner2@company-b.com", seed_data["comp2"].id
    )
    company_b_settings = await client.get(
        "/api/v1/companies/current/reminder-settings",
        headers=company_b_headers,
    )
    assert company_b_settings.status_code == 200
    assert company_b_settings.json()["high_priority_days"] == 15

    invalid = await client.patch(
        "/api/v1/companies/current/reminder-settings",
        headers=company_a_headers,
        json={"trigger_time": "25:99"},
    )
    assert invalid.status_code == 422

    manager_headers = await auth_headers(
        client,
        "consultant@fashion.com",
        seed_data["comp1"].id,
        password="ConsultantPass123!",
    )
    forbidden = await client.patch(
        "/api/v1/companies/current/reminder-settings",
        headers=manager_headers,
        json={"enabled": False},
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_order_reminders_dispatch_to_active_company_users_once_per_local_day(
    db_session, seed_data, monkeypatch
):
    company_a = seed_data["comp1"]
    company_b = seed_data["comp2"]
    local_timezone = ZoneInfo("Asia/Kolkata")
    local_now = datetime(2026, 4, 20, 9, 0, tzinfo=local_timezone)
    now_utc = local_now.astimezone(timezone.utc)
    reminder_settings = {
        "high_priority_days": 5,
        "high_priority_recurring": "daily",
        "normal_priority_days": 10,
        "normal_priority_recurring": "every_2_days",
        "low_priority_days": 5,
        "low_priority_recurring": "every_1_day",
        "trigger_time": "09:00",
        "timezone": "Asia/Kolkata",
        "enabled": True,
    }
    company_a.settings = {"reminder": reminder_settings}
    company_b.settings = {"reminder": reminder_settings}

    customer_a = Customer(
        company_id=company_a.id,
        name="Reminder Customer A",
        phone_number="+919876543210",
    )
    customer_b = Customer(
        company_id=company_b.id,
        name="Reminder Customer B",
        phone_number="+919876543211",
    )
    db_session.add_all([customer_a, customer_b])
    await db_session.flush()

    orders = [
        Order(
            company_id=company_a.id,
            customer_id=customer_a.id,
            order_number="REM-A-001",
            order_date=now_utc,
            due_date=(local_now + timedelta(days=5)).astimezone(timezone.utc),
            status="stitching",
            priority="high",
        ),
        Order(
            company_id=company_a.id,
            customer_id=customer_a.id,
            order_number="REM-A-DELIVERED",
            order_date=now_utc,
            due_date=(local_now + timedelta(days=5)).astimezone(timezone.utc),
            status="delivered",
            priority="high",
        ),
        Order(
            company_id=company_a.id,
            customer_id=customer_a.id,
            order_number="REM-A-CANCELLED",
            order_date=now_utc,
            due_date=(local_now + timedelta(days=5)).astimezone(timezone.utc),
            status="cancelled",
            priority="high",
        ),
        Order(
            company_id=company_b.id,
            customer_id=customer_b.id,
            order_number="REM-B-001",
            order_date=now_utc,
            due_date=(local_now + timedelta(days=5)).astimezone(timezone.utc),
            status="stitching",
            priority="high",
        ),
    ]
    db_session.add_all(orders)
    db_session.add(NotificationSubscription(
        endpoint="https://push.example.test/owner-a",
        user_id=seed_data["owner1"].id,
        company_id=company_a.id,
        p256dh_key="p256dh",
        auth_key="auth",
    ))
    await db_session.commit()

    monkeypatch.setattr(settings, "WEB_PUSH_VAPID_PRIVATE_KEY", "test-private-key")
    queued_pushes: list[tuple] = []
    monkeypatch.setattr(send_web_push, "delay", lambda *args: queued_pushes.append(args))

    dispatched = await _dispatch_due_order_reminders(db_session, now_utc)
    assert dispatched == 4
    notifications = (await db_session.execute(select(Notification))).scalars().all()
    assert len(notifications) == 4
    assert all(item.type == "order_reminder" for item in notifications)
    assert {item.company_id for item in notifications} == {company_a.id, company_b.id}
    assert all(
        item.recipient_id in {seed_data["owner1"].id, seed_data["multi_user"].id}
        for item in notifications
        if item.company_id == company_a.id
    )
    assert all(
        item.recipient_id in {seed_data["owner2"].id, seed_data["multi_user"].id}
        for item in notifications
        if item.company_id == company_b.id
    )
    assert len(queued_pushes) == 1

    duplicate_run = await _dispatch_due_order_reminders(db_session, now_utc)
    assert duplicate_run == 0
    assert len((await db_session.execute(select(OrderReminderDispatch))).scalars().all()) == 4
