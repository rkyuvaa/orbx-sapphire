import pytest
from httpx import AsyncClient


async def auth_headers(client: AsyncClient, email: str, company_id: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "OwnerPass123!"},
    )
    assert response.status_code == 200
    return {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "X-Company-ID": company_id,
    }


@pytest.mark.asyncio
async def test_notification_preferences_return_defaults_when_not_saved(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)

    response = await client.get("/api/v1/notifications/preferences", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "in_app_enabled": True,
        "web_push_enabled": True,
        "type_preferences": {},
    }


@pytest.mark.asyncio
async def test_notification_preferences_can_be_updated(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)

    updated = await client.put(
        "/api/v1/notifications/preferences",
        headers=headers,
        json={"in_app_enabled": False, "type_preferences": {"order_created": False}},
    )

    assert updated.status_code == 200
    assert updated.json() == {
        "in_app_enabled": False,
        "web_push_enabled": True,
        "type_preferences": {"order_created": False},
    }
