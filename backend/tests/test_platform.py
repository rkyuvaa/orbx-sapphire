import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_superadmin_dashboard_access(client: AsyncClient, seed_data):
    # Log in Super Admin
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "superadmin@orbx.in",
        "password": "SuperAdminPass123!"
    })
    token = login_res.json()["access_token"]

    res = await client.get("/api/v1/platform/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_companies"] >= 2
    assert "active_companies" in data
    assert "plan_distribution" in data

@pytest.mark.asyncio
async def test_regular_user_cannot_access_platform(client: AsyncClient, seed_data):
    # Log in non-superadmin owner
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "OwnerPass123!"
    })
    token = login_res.json()["access_token"]

    res = await client.get("/api/v1/platform/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert "Super Admin" in res.json()["detail"]

@pytest.mark.asyncio
async def test_create_company_with_owner_provisioning(client: AsyncClient, seed_data):
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "superadmin@orbx.in",
        "password": "SuperAdminPass123!"
    })
    token = login_res.json()["access_token"]

    new_comp_payload = {
        "name": "Emerald Couture Studio",
        "code": "emerald-couture",
        "owner_name": "Madame Emerald",
        "owner_email": "emerald@couture.com",
        "contact_phone": "+91 98765 43210"
    }

    create_res = await client.post(
        "/api/v1/platform/companies",
        json=new_comp_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["company"]["code"] == "emerald-couture"
    assert created_data["company"]["status"] == "pending_activation"
    invitation_token = created_data["invitation_token"]
    assert invitation_token is not None

    # Verify invitation public endpoint
    verify_res = await client.get(f"/api/v1/invitations/verify/{invitation_token}")
    assert verify_res.status_code == 200
    assert verify_res.json()["email"] == "emerald@couture.com"

    # Activate the new owner's account
    activate_res = await client.post("/api/v1/auth/activate", json={
        "token": invitation_token,
        "full_name": "Madame Emerald",
        "password": "EmeraldSecret2026!"
    })
    assert activate_res.status_code == 200
    owner_token = activate_res.json()["access_token"]

    # The activated owner can now fetch /me and their new workspace
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_token}"})
    assert me_res.status_code == 200
    assert len(me_res.json()["memberships"]) == 1
    assert me_res.json()["memberships"][0]["company_code"] == "emerald-couture"


@pytest.mark.asyncio
async def test_created_company_owner_password_preserves_whitespace(
    client: AsyncClient, seed_data
):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@orbx.in", "password": "SuperAdminPass123!"},
    )
    token = login_res.json()["access_token"]
    password = "  EmeraldSecret2026!  "

    create_res = await client.post(
        "/api/v1/platform/companies",
        json={
            "name": "Whitespace Password Studio",
            "code": "whitespace-password-studio",
            "owner_name": "Emerald Owner",
            "owner_email": "whitespace-owner@example.com",
            "owner_password": password,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201, create_res.text
    assert create_res.json()["company"]["status"] == "active"

    owner_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "whitespace-owner@example.com", "password": password},
    )
    assert owner_login.status_code == 200, owner_login.text


@pytest.mark.asyncio
async def test_created_company_owner_can_login_with_long_unicode_password(
    client: AsyncClient, seed_data
):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@orbx.in", "password": "SuperAdminPass123!"},
    )
    token = login_res.json()["access_token"]
    password = "測" * 30

    create_res = await client.post(
        "/api/v1/platform/companies",
        json={
            "name": "Long Password Studio",
            "code": "long-password-studio",
            "owner_name": "Long Password Owner",
            "owner_email": "long-password-owner@example.com",
            "owner_password": password,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201, create_res.text

    owner_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "long-password-owner@example.com", "password": password},
    )
    assert owner_login.status_code == 200, owner_login.text
