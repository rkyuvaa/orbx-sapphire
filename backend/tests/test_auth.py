import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, seed_data):
    res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "OwnerPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, seed_data):
    res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_auth_me_returns_memberships(client: AsyncClient, seed_data):
    # Log in multi-company user
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "consultant@fashion.com",
        "password": "ConsultantPass123!"
    })
    token = login_res.json()["access_token"]

    res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    user_info = res.json()
    assert user_info["email"] == "consultant@fashion.com"
    assert user_info["is_superadmin"] is False
    # User belongs to both Alpha (as manager) and Beta (as staff)
    assert len(user_info["memberships"]) == 2
    comp_codes = {m["company_code"] for m in user_info["memberships"]}
    assert "company-alpha" in comp_codes
    assert "company-beta" in comp_codes

@pytest.mark.asyncio
async def test_password_reset_flow(client: AsyncClient, seed_data):
    # 1. Request reset
    req_res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "owner1@company-a.com"
    })
    assert req_res.status_code == 200
    token = req_res.json().get("reset_token")
    assert token is not None

    # 2. Reset password
    confirm_res = await client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "NewOwnerPass456!"
    })
    assert confirm_res.status_code == 200

    # 3. Log in with new password
    new_login = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "NewOwnerPass456!"
    })
    assert new_login.status_code == 200
