import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_tenant_context_authorized_access(client: AsyncClient, seed_data):
    # Log in Owner Alpha
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "OwnerPass123!"
    })
    token = login_res.json()["access_token"]
    comp1_id = seed_data["comp1"].id

    res = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp1_id
        }
    )
    assert res.status_code == 200
    assert res.json()["id"] == comp1_id
    assert res.json()["code"] == "company-alpha"

@pytest.mark.asyncio
async def test_cross_tenant_access_prevented(client: AsyncClient, seed_data):
    # Log in Owner Alpha
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "OwnerPass123!"
    })
    token = login_res.json()["access_token"]
    comp2_id = seed_data["comp2"].id  # Company Beta

    # Owner Alpha attempts to query Company Beta with forged X-Company-ID
    res = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp2_id
        }
    )
    # Must be strictly rejected!
    assert res.status_code == 403
    assert "not an authorized member" in res.json()["detail"]

@pytest.mark.asyncio
async def test_suspended_company_access_blocked(client: AsyncClient, seed_data):
    # Owner Alpha belongs to suspended company
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "owner1@company-a.com",
        "password": "OwnerPass123!"
    })
    token = login_res.json()["access_token"]
    comp_susp_id = seed_data["comp_susp"].id

    res = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp_susp_id
        }
    )
    assert res.status_code == 403
    assert "suspended" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_multi_company_switching(client: AsyncClient, seed_data):
    # Multi-company user
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "consultant@fashion.com",
        "password": "ConsultantPass123!"
    })
    token = login_res.json()["access_token"]
    comp1_id = seed_data["comp1"].id
    comp2_id = seed_data["comp2"].id

    # 1. Access Company Alpha
    res1 = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp1_id
        }
    )
    assert res1.status_code == 200
    assert res1.json()["code"] == "company-alpha"

    # 2. Switch context to Company Beta
    res2 = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp2_id
        }
    )
    assert res2.status_code == 200
    assert res2.json()["code"] == "company-beta"

@pytest.mark.asyncio
async def test_superadmin_cannot_access_tenant_without_membership(client: AsyncClient, seed_data):
    # Super Admin logs in
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "superadmin@orbx.in",
        "password": "SuperAdminPass123!"
    })
    token = login_res.json()["access_token"]
    comp1_id = seed_data["comp1"].id

    # Super admin does not automatically become a member of tenant workspace
    res = await client.get(
        "/api/v1/companies/current",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp1_id
        }
    )
    assert res.status_code == 403
