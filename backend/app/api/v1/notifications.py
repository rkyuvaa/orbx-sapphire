from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit_event
from app.core.database import get_db
from app.core.deps import get_current_user, get_tenant_context
from app.core.redis import get_redis, tenant_cache_key
from app.models.notification import Notification, NotificationPreference, NotificationSubscription
from app.models.user import User
from app.schemas.notification import (
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
    WebPushSubscriptionCreate,
    WebPushSubscriptionDelete,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


async def enforce_rate_limit(company_id: str, user_id: str, action: str) -> None:
    """Best-effort rate limiting; Redis outages must not block notification access."""
    redis = await get_redis()
    if redis is None:
        return
    key = tenant_cache_key(company_id, f"notification-rate:{action}:{user_id}")
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 60)
        if count > 30:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    except HTTPException:
        raise
    except Exception:
        return


def tenant_ids(tenant_context: tuple) -> tuple[str, str]:
    company, membership = tenant_context
    if membership.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active membership required")
    return company.id, membership.user_id


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    await enforce_rate_limit(company_id, user_id, "list")
    limit = max(1, min(limit, 100))
    stmt = (
        select(Notification)
        .where(Notification.company_id == company_id, Notification.recipient_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(max(offset, 0))
        .limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    await enforce_rate_limit(company_id, user_id, "read")
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.company_id == company_id,
        Notification.recipient_id == user_id,
    )
    notification = (await db.execute(stmt)).scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)
    return notification


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe_web_push(
    payload: WebPushSubscriptionCreate,
    request: Request,
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    await enforce_rate_limit(company_id, user_id, "subscribe")
    subscription = (await db.execute(
        select(NotificationSubscription).where(NotificationSubscription.endpoint == payload.endpoint)
    )).scalar_one_or_none()
    if subscription is None:
        subscription = NotificationSubscription(
            endpoint=payload.endpoint, user_id=user_id, company_id=company_id,
            p256dh_key=payload.keys.p256dh, auth_key=payload.keys.auth,
            user_agent=request.headers.get("user-agent"),
        )
        db.add(subscription)
    else:
        subscription.user_id = user_id
        subscription.company_id = company_id
        subscription.p256dh_key = payload.keys.p256dh
        subscription.auth_key = payload.keys.auth
        subscription.user_agent = request.headers.get("user-agent")
        subscription.revoked_at = None
    await db.commit()
    await log_audit_event(db, "web_push_subscription_created", "notification_subscription", subscription.id,
                          user_id, company_id, {"endpoint": payload.endpoint}, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_web_push(
    payload: WebPushSubscriptionDelete,
    request: Request,
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    await enforce_rate_limit(company_id, user_id, "unsubscribe")
    subscription = (await db.execute(select(NotificationSubscription).where(
        NotificationSubscription.endpoint == payload.endpoint,
        NotificationSubscription.company_id == company_id,
        NotificationSubscription.user_id == user_id,
        NotificationSubscription.revoked_at.is_(None),
    ))).scalar_one_or_none()
    if subscription is not None:
        subscription.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        await log_audit_event(db, "web_push_subscription_revoked", "notification_subscription", subscription.id,
                              user_id, company_id, {"endpoint": payload.endpoint}, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/preferences", response_model=NotificationPreferenceOut)
async def get_preferences(
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    preference = (await db.execute(select(NotificationPreference).where(
        NotificationPreference.company_id == company_id, NotificationPreference.user_id == user_id
    ))).scalar_one_or_none()
    if preference is None:
        return NotificationPreferenceOut(
            in_app_enabled=True,
            web_push_enabled=True,
            type_preferences={},
        )
    return preference


@router.put("/preferences", response_model=NotificationPreferenceOut)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    tenant_context: Annotated[tuple, Depends(get_tenant_context)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    company_id, user_id = tenant_ids(tenant_context)
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant identity mismatch")
    await enforce_rate_limit(company_id, user_id, "preferences")
    preference = (await db.execute(select(NotificationPreference).where(
        NotificationPreference.company_id == company_id, NotificationPreference.user_id == user_id
    ))).scalar_one_or_none()
    if preference is None:
        preference = NotificationPreference(user_id=user_id, company_id=company_id)
        db.add(preference)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(preference, field, value)
    await db.commit()
    await db.refresh(preference)
    return preference
