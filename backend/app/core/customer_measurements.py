from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Customer, CustomerMeasurement, Order, OrderMeasurement, MeasurementField, MeasurementTab


async def save_order_measurements(
    db: AsyncSession,
    order: Order,
    company_id: str,
    values: dict[str, str | None],
) -> list[OrderMeasurement]:
    configured_rows = (
        await db.execute(
            select(MeasurementField, MeasurementTab)
            .join(MeasurementTab, MeasurementField.tab_id == MeasurementTab.id)
            .where(
                MeasurementTab.company_id == company_id,
            )
        )
    ).all()
    configured_fields = {field.id: (field, tab) for field, tab in configured_rows}

    valid_values = {field_id: val for field_id, val in values.items() if field_id in configured_fields}

    for field, tab in configured_fields.values():
        if field.enabled and tab.enabled and field.required and not (valid_values.get(field.id) or "").strip():
            raise ValueError(f"{field.name} is required")

    stored = (
        await db.execute(
            select(OrderMeasurement).where(
                OrderMeasurement.order_id == order.id,
                OrderMeasurement.field_id.in_(configured_fields.keys()),
            )
        )
    ).scalars().all()
    stored_by_field = {item.field_id: item for item in stored}

    for field_id, value in valid_values.items():
        field, tab = configured_fields[field_id]
        measurement = stored_by_field.get(field_id)
        if measurement is None:
            measurement = OrderMeasurement(
                order_id=order.id,
                field_id=field.id,
                tab_id=tab.id,
                tab_name=tab.name,
                field_name=field.name,
                field_type=field.field_type,
                unit=field.unit,
                value=value,
            )
            db.add(measurement)
        else:
            measurement.tab_id = tab.id
            measurement.tab_name = tab.name
            measurement.field_name = field.name
            measurement.field_type = field.field_type
            measurement.unit = field.unit
            measurement.value = value

    await db.flush()
    return (
        await db.execute(
            select(OrderMeasurement)
            .where(OrderMeasurement.order_id == order.id)
            .order_by(OrderMeasurement.tab_name, OrderMeasurement.field_name)
        )
    ).scalars().all()


async def save_customer_measurements(
    db: AsyncSession,
    customer: Customer,
    company_id: str,
    values: dict[str, str | None],
) -> list[CustomerMeasurement]:
    configured_rows = (
        await db.execute(
            select(MeasurementField, MeasurementTab)
            .join(MeasurementTab, MeasurementField.tab_id == MeasurementTab.id)
            .where(
                MeasurementTab.company_id == company_id,
            )
        )
    ).all()
    configured_fields = {field.id: (field, tab) for field, tab in configured_rows}

    valid_values = {field_id: val for field_id, val in values.items() if field_id in configured_fields}

    for field, tab in configured_fields.values():
        if field.enabled and tab.enabled and field.required and not (valid_values.get(field.id) or "").strip():
            raise ValueError(f"{field.name} is required")

    stored = (
        await db.execute(
            select(CustomerMeasurement).where(
                CustomerMeasurement.customer_id == customer.id,
                CustomerMeasurement.field_id.in_(configured_fields.keys()),
            )
        )
    ).scalars().all()
    stored_by_field = {item.field_id: item for item in stored}

    for field_id, value in valid_values.items():
        field, tab = configured_fields[field_id]
        measurement = stored_by_field.get(field_id)
        if measurement is None:
            measurement = CustomerMeasurement(
                customer_id=customer.id,
                field_id=field.id,
                tab_id=tab.id,
                tab_name=tab.name,
                field_name=field.name,
                field_type=field.field_type,
                unit=field.unit,
                value=value,
            )
            db.add(measurement)
        else:
            measurement.tab_id = tab.id
            measurement.tab_name = tab.name
            measurement.field_name = field.name
            measurement.field_type = field.field_type
            measurement.unit = field.unit
            measurement.value = value

    await db.flush()
    return (
        await db.execute(
            select(CustomerMeasurement)
            .where(CustomerMeasurement.customer_id == customer.id)
            .order_by(CustomerMeasurement.tab_name, CustomerMeasurement.field_name)
        )
    ).scalars().all()
