import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.models.order import (
    Customer,
    CustomerMeasurement,
    MeasurementField,
    MeasurementTab,
    Order,
)


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
async def test_customer_records_are_company_scoped(client: AsyncClient, seed_data):
    alpha_headers = await auth_headers(
        client, "owner1@company-a.com", seed_data["comp1"].id
    )
    beta_headers = await auth_headers(
        client, "owner2@company-b.com", seed_data["comp2"].id
    )

    created = await client.post(
        "/api/v1/orders/customers",
        headers=alpha_headers,
        json={"name": "Mira Customer", "phone_number": "+919876543210", "address": "Alpha"},
    )
    assert created.status_code == 201
    customer_id = created.json()["id"]

    listed = await client.get("/api/v1/orders/customers", headers=beta_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    hidden = await client.get(
        f"/api/v1/orders/customers/{customer_id}", headers=beta_headers
    )
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_customer_delete_is_blocked_when_orders_are_linked(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    created = await client.post(
        "/api/v1/orders/customers",
        headers=headers,
        json={"name": "Customer With Order", "phone_number": "+919876543210"},
    )
    assert created.status_code == 201, created.text
    customer_id = created.json()["id"]

    order = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"customer_id": customer_id},
    )
    assert order.status_code == 201, order.text

    deleted = await client.delete(
        f"/api/v1/orders/customers/{customer_id}", headers=headers
    )

    assert deleted.status_code == 409
    assert "orders or saved measurements are linked" in deleted.json()["detail"]
    existing_customer = await client.get(
        f"/api/v1/orders/customers/{customer_id}", headers=headers
    )
    assert existing_customer.status_code == 200


@pytest.mark.asyncio
async def test_customer_delete_is_blocked_when_measurements_are_linked(
    client: AsyncClient, db_session, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    created = await client.post(
        "/api/v1/orders/customers",
        headers=headers,
        json={"name": "Customer With Measurements", "phone_number": "+919876543210"},
    )
    assert created.status_code == 201, created.text
    customer_id = created.json()["id"]
    db_session.add(
        CustomerMeasurement(
            customer_id=customer_id,
            tab_name="Body",
            field_name="Waist",
            field_type="number",
            unit="cm",
            value="70",
        )
    )
    await db_session.commit()

    deleted = await client.delete(
        f"/api/v1/orders/customers/{customer_id}", headers=headers
    )

    assert deleted.status_code == 409
    existing_customer = await client.get(
        f"/api/v1/orders/customers/{customer_id}", headers=headers
    )
    measurements = await client.get(
        f"/api/v1/orders/customers/{customer_id}/measurements", headers=headers
    )
    assert existing_customer.status_code == 200
    assert measurements.status_code == 200
    assert len(measurements.json()) == 1


@pytest.mark.asyncio
async def test_customer_without_linked_records_can_be_deleted(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    created = await client.post(
        "/api/v1/orders/customers",
        headers=headers,
        json={"name": "Customer Without Records", "phone_number": "+919876543210"},
    )
    assert created.status_code == 201, created.text

    deleted = await client.delete(
        f"/api/v1/orders/customers/{created.json()['id']}", headers=headers
    )

    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_customer_order_page_api_routes_return_collection_responses(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)

    customers = await client.get("/api/v1/orders/customers", headers=headers)
    orders = await client.get("/api/v1/orders", headers=headers)
    config = await client.get("/api/v1/orders/measurement-config", headers=headers)

    assert customers.status_code == 200, customers.text
    assert customers.json() == []
    assert orders.status_code == 200, orders.text
    assert orders.json() == []
    assert config.status_code == 200, config.text
    assert config.json() == []


@pytest.mark.asyncio
async def test_order_list_includes_customer_summary(client, db_session, seed_data):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    customer = Customer(
        company_id=seed_data["comp1"].id,
        name="Order List Customer",
        phone_number="+919876543210",
    )
    db_session.add(customer)
    await db_session.flush()
    order = Order(
        company_id=seed_data["comp1"].id,
        customer_id=customer.id,
        created_by_id=seed_data["owner1"].id,
        order_number="COMPANY-ALPHA-TEST",
        status="order_received",
    )
    db_session.add(order)
    await db_session.commit()

    response = await client.get("/api/v1/orders", headers=headers)

    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    item = response.json()[0]
    assert item["id"] == order.id
    assert item["company_id"] == seed_data["comp1"].id
    assert item["order_number"] == "COMPANY-ALPHA-TEST"
    assert item["customer_name"] == "Order List Customer"
    assert item["customer_phone"] == "+919876543210"
    assert item["is_overdue"] is False


@pytest.mark.asyncio
async def test_order_list_search_matches_order_number_customer_name_and_phone(
    client: AsyncClient, db_session, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    customer = Customer(
        company_id=seed_data["comp1"].id,
        name="Searchable Customer",
        phone_number="+919876543210",
    )
    db_session.add(customer)
    await db_session.flush()
    order = Order(
        company_id=seed_data["comp1"].id,
        customer_id=customer.id,
        created_by_id=seed_data["owner1"].id,
        order_number="ORD-SEARCH-123",
        status="order_received",
    )
    db_session.add(order)
    await db_session.commit()

    for query in ("SEARCH-123", "searchable", "876543210"):
        response = await client.get(
            "/api/v1/orders",
            headers=headers,
            params={"search": query},
        )

        assert response.status_code == 200, response.text
        assert [item["id"] for item in response.json()] == [order.id]


@pytest.mark.asyncio
async def test_upcoming_orders_use_local_days_and_exclude_terminal_or_other_company_orders(
    client: AsyncClient, db_session, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    local_timezone = ZoneInfo("Asia/Kolkata")
    today = datetime.now(local_timezone).date()
    customer = Customer(
        company_id=seed_data["comp1"].id,
        name="Upcoming Board Customer",
        phone_number="+919876543219",
    )
    other_company_customer = Customer(
        company_id=seed_data["comp2"].id,
        name="Other Company Customer",
        phone_number="+919876543220",
    )
    db_session.add_all([customer, other_company_customer])
    await db_session.flush()

    def due_on(day_offset: int) -> datetime:
        return datetime.combine(
            today + timedelta(days=day_offset),
            datetime.min.time(),
            tzinfo=local_timezone,
        ) + timedelta(hours=15)

    expected_orders = [
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-TODAY",
            status="stitching",
            due_date=due_on(0),
        ),
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-DAY-2",
            status="ready_for_delivery",
            due_date=due_on(2),
        ),
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-DAY-4",
            status="stitching",
            due_date=due_on(4),
        ),
    ]
    excluded_orders = [
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-DAY-5",
            status="stitching",
            due_date=due_on(5),
        ),
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-DELIVERED",
            status="delivered",
            due_date=due_on(1),
        ),
        Order(
            company_id=seed_data["comp1"].id,
            customer_id=customer.id,
            order_number="UPCOMING-CANCELLED",
            status="cancelled",
            due_date=due_on(1),
        ),
        Order(
            company_id=seed_data["comp2"].id,
            customer_id=other_company_customer.id,
            order_number="UPCOMING-OTHER-COMPANY",
            status="stitching",
            due_date=due_on(1),
        ),
    ]
    db_session.add_all([*expected_orders, *excluded_orders])
    await db_session.commit()

    response = await client.get(
        "/api/v1/orders/upcoming?timezone=Asia%2FKolkata",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert {item["id"] for item in response.json()} == {order.id for order in expected_orders}
    assert all(item["customer_phone"] == customer.phone_number for item in response.json())
    invalid_timezone = await client.get(
        "/api/v1/orders/upcoming?timezone=Invalid%2FTimeZone",
        headers=headers,
    )
    assert invalid_timezone.status_code == 400


@pytest.mark.asyncio
async def test_order_creation_auto_saves_customer_and_tracks_status(client: AsyncClient, seed_data):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)

    created = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "customer": {
                "name": "Asha Tailoring",
                "phone_number": "+919876543211",
                "address": "Market Road",
            },
            "due_date": "2026-11-01T00:00:00Z",
            "priority": "high",
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["order_number"] == "ORD-000001"
    assert order["status"] == "order_received"
    assert order["priority"] == "high"
    assert order["customer"]["name"] == "Asha Tailoring"
    assert len(order["status_history"]) == 1

    reused = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "customer": {
                "name": "Asha Updated",
                "phone_number": "+919876543211",
            },
        },
    )
    assert reused.status_code == 201, reused.text
    assert reused.json()["customer_id"] == order["customer_id"]
    assert reused.json()["priority"] == "normal"

    updated_priority = await client.patch(
        f"/api/v1/orders/{order['id']}",
        headers=headers,
        json={"priority": "low"},
    )
    assert updated_priority.status_code == 200, updated_priority.text
    assert updated_priority.json()["priority"] == "low"

    invalid_priority = await client.patch(
        f"/api/v1/orders/{order['id']}",
        headers=headers,
        json={"priority": "urgent"},
    )
    assert invalid_priority.status_code == 422

    customers = await client.get(
        "/api/v1/orders/customers?search=%2B91%209876%20543211", headers=headers
    )
    assert customers.status_code == 200
    assert len(customers.json()) == 1
    assert customers.json()[0]["id"] == order["customer_id"]


@pytest.mark.asyncio
async def test_order_numbering_is_company_scoped_and_configurable(client, seed_data):
    alpha_headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    beta_headers = await auth_headers(client, "owner2@company-b.com", seed_data["comp2"].id)

    updated = await client.patch(
        "/api/v1/companies/current/document-numbering",
        headers=alpha_headers,
        json={"prefix": "CLIENT-", "next_number": 41},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json() == {"prefix": "CLIENT-", "next_number": 41}

    created = await client.post(
        "/api/v1/orders",
        headers=alpha_headers,
        json={"customer": {"name": "Numbered Customer", "phone_number": "+919876543213"}},
    )
    assert created.status_code == 201, created.text
    assert created.json()["order_number"] == "CLIENT-000041"

    beta_settings = await client.get(
        "/api/v1/companies/current/document-numbering",
        headers=beta_headers,
    )
    assert beta_settings.status_code == 200
    assert beta_settings.json() == {"prefix": "ORD-", "next_number": 1}


@pytest.mark.asyncio
async def test_customer_measurements_are_shared_and_order_metadata_is_editable(
    client: AsyncClient, db_session, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    tab = MeasurementTab(company_id=seed_data["comp1"].id, name="Upper body", enabled=True)
    db_session.add(tab)
    await db_session.flush()
    field = MeasurementField(
        tab_id=tab.id,
        name="Chest",
        field_type="number",
        unit="cm",
        required=False,
        enabled=True,
        order=0,
    )
    db_session.add(field)
    await db_session.commit()

    created = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "customer": {"name": "Shared Measurements", "phone_number": "+919876543214"},
            "order_number": "ORD-EDIT-001",
            "order_date": "2026-10-20T00:00:00Z",
            "measurements": [{"tab_id": tab.id, "field_id": field.id, "value": "92"}],
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["order_number"] == "ORD-EDIT-001"
    assert order["order_date"].startswith("2026-10-20")
    assert order["priority"] == "normal"
    customer_id = order["customer_id"]
    assert order["measurements"][0]["value"] == "92"

    master_measurements = await client.get(
        f"/api/v1/orders/customers/{customer_id}/measurements",
        headers=headers,
    )
    assert master_measurements.status_code == 200
    assert master_measurements.json()[0]["value"] == "92"

    updated_measurements = await client.put(
        f"/api/v1/orders/customers/{customer_id}/measurements",
        headers=headers,
        json=[{"field_id": field.id, "value": "101"}],
    )
    assert updated_measurements.status_code == 200, updated_measurements.text

    updated_order = await client.patch(
        f"/api/v1/orders/{order['id']}",
        headers=headers,
        json={
            "order_number": "ORD-EDIT-002",
            "order_date": "2026-10-21T00:00:00Z",
            "priority": "high",
        },
    )
    assert updated_order.status_code == 200, updated_order.text
    assert updated_order.json()["priority"] == "high"
    assert updated_order.json()["order_number"] == "ORD-EDIT-002"
    assert updated_order.json()["order_date"].startswith("2026-10-21")
    assert updated_order.json()["measurements"][0]["value"] == "101"


@pytest.mark.asyncio
async def test_order_status_requires_sequential_progress_and_cancel_reason(
    client: AsyncClient, seed_data
):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    customer = await client.post(
        "/api/v1/orders/customers",
        headers=headers,
        json={"name": "Status Test", "phone_number": "+919876543212"},
    )
    assert customer.status_code == 201
    order = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"customer_id": customer.json()["id"]},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    skipped = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=headers,
        json={"status": "cutting"},
    )
    assert skipped.status_code == 400

    no_reason = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert no_reason.status_code == 400

    advanced = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=headers,
        json={"status": "material_marking"},
    )
    assert advanced.status_code == 200
    assert advanced.json()["status"] == "material_marking"
    assert len(advanced.json()["status_history"]) == 2


@pytest.mark.asyncio
async def test_order_measurements_require_company_configuration(client: AsyncClient, seed_data):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    config = await client.post(
        "/api/v1/orders/measurement-config/tabs",
        headers=headers,
        json={
            "name": "Upper Body",
            "fields": [
                {
                    "name": "Chest",
                    "field_type": "number",
                    "unit": "cm",
                    "required": True,
                }
            ],
        },
    )
    assert config.status_code == 201, config.text
    tab = config.json()
    field = tab["fields"][0]
    customer = await client.post(
        "/api/v1/orders/customers",
        headers=headers,
        json={"name": "Measurement Test", "phone_number": "+919876543213"},
    )

    missing = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"customer_id": customer.json()["id"]},
    )
    assert missing.status_code == 400
    assert "Chest is required" in missing.json()["detail"]

    created = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "customer_id": customer.json()["id"],
            "measurements": [
                {
                    "tab_id": tab["id"],
                    "field_id": field["id"],
                    "value": "92",
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["measurements"][0]["field_name"] == "Chest"
    assert created.json()["measurements"][0]["tab_name"] == "Upper Body"

    updated = await client.patch(
        f"/api/v1/orders/{created.json()['id']}",
        headers=headers,
        json={
            "due_date": "2026-11-05T00:00:00Z",
            "measurements": [
                {"tab_id": tab["id"], "field_id": field["id"], "value": "96"}
            ],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["measurements"][0]["value"] == "96"
    assert updated.json()["due_date"] is not None

    cleared_due_date = await client.patch(
        f"/api/v1/orders/{created.json()['id']}",
        headers=headers,
        json={"due_date": None},
    )
    assert cleared_due_date.status_code == 200, cleared_due_date.text
    assert cleared_due_date.json()["due_date"] is None


@pytest.mark.asyncio
async def test_measurement_configuration_can_be_reordered(client: AsyncClient, seed_data):
    headers = await auth_headers(client, "owner1@company-a.com", seed_data["comp1"].id)
    first = await client.post(
        "/api/v1/orders/measurement-config/tabs",
        headers=headers,
        json={
            "name": "First tab",
            "fields": [
                {"name": "First field", "field_type": "number", "unit": "cm"},
                {"name": "Second field", "field_type": "number", "unit": "cm"},
            ],
        },
    )
    second = await client.post(
        "/api/v1/orders/measurement-config/tabs",
        headers=headers,
        json={"name": "Second tab"},
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    first_tab = first.json()
    second_tab = second.json()

    reordered_tabs = await client.put(
        "/api/v1/orders/measurement-config/tabs/order",
        headers=headers,
        json={"tab_ids": [second_tab["id"], first_tab["id"]]},
    )
    assert reordered_tabs.status_code == 204

    fields = first_tab["fields"]
    reordered_fields = await client.put(
        f"/api/v1/orders/measurement-config/tabs/{first_tab['id']}/fields/order",
        headers=headers,
        json={"field_ids": [fields[1]["id"], fields[0]["id"]]},
    )
    assert reordered_fields.status_code == 204

    config = await client.get("/api/v1/orders/measurement-config", headers=headers)
    assert config.status_code == 200
    assert [tab["id"] for tab in config.json()] == [second_tab["id"], first_tab["id"]]
    first_tab_after_reorder = config.json()[1]
    assert [field["id"] for field in first_tab_after_reorder["fields"]] == [
        fields[1]["id"],
        fields[0]["id"],
    ]


@pytest.mark.asyncio
async def test_measurement_configuration_is_company_scoped(client: AsyncClient, seed_data):
    alpha_headers = await auth_headers(
        client, "owner1@company-a.com", seed_data["comp1"].id
    )
    beta_headers = await auth_headers(
        client, "owner2@company-b.com", seed_data["comp2"].id
    )

    alpha_tab_response = await client.post(
        "/api/v1/orders/measurement-config/tabs",
        headers=alpha_headers,
        json={
            "name": "Alpha blouse",
            "fields": [
                {"name": "Chest", "field_type": "number", "unit": "cm"}
            ],
        },
    )
    assert alpha_tab_response.status_code == 201, alpha_tab_response.text
    alpha_tab = alpha_tab_response.json()
    alpha_field = alpha_tab["fields"][0]

    beta_tab_response = await client.post(
        "/api/v1/orders/measurement-config/tabs",
        headers=beta_headers,
        json={"name": "Beta chudi"},
    )
    assert beta_tab_response.status_code == 201, beta_tab_response.text
    beta_tab = beta_tab_response.json()

    beta_config = await client.get(
        "/api/v1/orders/measurement-config", headers=beta_headers
    )
    assert beta_config.status_code == 200
    assert [tab["id"] for tab in beta_config.json()] == [beta_tab["id"]]

    hidden_tab_update = await client.patch(
        f"/api/v1/orders/measurement-config/tabs/{alpha_tab['id']}",
        headers=beta_headers,
        json={"name": "Changed by Beta"},
    )
    assert hidden_tab_update.status_code == 404

    hidden_field_update = await client.patch(
        f"/api/v1/orders/measurement-config/fields/{alpha_field['id']}",
        headers=beta_headers,
        json={"name": "Changed by Beta"},
    )
    assert hidden_field_update.status_code == 404

    hidden_tab_delete = await client.delete(
        f"/api/v1/orders/measurement-config/tabs/{alpha_tab['id']}",
        headers=beta_headers,
    )
    assert hidden_tab_delete.status_code == 404

    cross_company_reorder = await client.put(
        "/api/v1/orders/measurement-config/tabs/order",
        headers=beta_headers,
        json={"tab_ids": [alpha_tab["id"], beta_tab["id"]]},
    )
    assert cross_company_reorder.status_code == 400

    beta_config_after_attempts = await client.get(
        "/api/v1/orders/measurement-config", headers=beta_headers
    )
    assert beta_config_after_attempts.status_code == 200
    assert [tab["id"] for tab in beta_config_after_attempts.json()] == [
        beta_tab["id"]
    ]
