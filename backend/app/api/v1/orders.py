from datetime import datetime, time, timedelta, timezone
from typing import Optional, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update, delete, or_, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.customer_measurements import save_customer_measurements, save_order_measurements
from app.core.document_numbering import (
    allocate_order_number,
    lock_order_document_numbering,
)
from app.core.deps import get_current_user, get_tenant_context, require_company_roles
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.order import (
    Customer, CustomerMeasurement, Order, OrderMeasurement, OrderStatusHistory,
    MeasurementTab, MeasurementField
)
from app.schemas.order import (
    OrderCreate, OrderUpdate, OrderStatusUpdate, OrderOut, OrderListOut,
    CustomerOut, CustomerMeasurementOut, OrderMeasurementOut, CustomerMeasurementInput,
    OrderStatusHistoryOut, OrderStatus as OrderStatusSchema, ORDER_STATUS_SEQUENCE,
    MeasurementTabCreate, MeasurementTabUpdate, MeasurementTabOut, MeasurementTabOrderUpdate,
    MeasurementFieldCreate, MeasurementFieldUpdate, MeasurementFieldOut,
    MeasurementFieldOrderUpdate
)

router = APIRouter(prefix="/orders", tags=["Orders"])


async def _get_order_out(db: AsyncSession, company_id: str, order_id: str) -> OrderOut:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.company_id == company_id)
        .options(
            selectinload(Order.customer),
            selectinload(Order.status_history).selectinload(OrderStatusHistory.changed_by),
            selectinload(Order.created_by),
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    measurements = (
        await db.execute(
            select(OrderMeasurement)
            .where(OrderMeasurement.order_id == order.id)
            .order_by(OrderMeasurement.tab_name, OrderMeasurement.field_name)
        )
    ).scalars().all()
    return OrderOut(
        id=order.id,
        company_id=order.company_id,
        customer_id=order.customer_id,
        created_by_id=order.created_by_id,
        order_number=order.order_number,
        order_date=order.order_date,
        status=order.status,
        due_date=order.due_date,
        priority=order.priority,
        created_at=order.created_at,
        updated_at=order.updated_at,
        customer=CustomerOut.model_validate(order.customer),
        created_by_name=order.created_by.full_name if order.created_by else None,
        status_history=[
            OrderStatusHistoryOut(
                id=item.id,
                order_id=item.order_id,
                old_status=item.old_status,
                new_status=item.new_status,
                reason=item.reason,
                changed_at=item.created_at,
                changed_by_name=item.changed_by.full_name if item.changed_by else None,
            )
            for item in order.status_history
        ],
        measurements=[OrderMeasurementOut.model_validate(item) for item in measurements],
    )


# ============ Order Endpoints ============

@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new order for current company."""
    company, _ = tenant

    # Validate submitted measurements against this company's active configuration.
    config_result = await db.execute(
        select(MeasurementField, MeasurementTab)
        .join(MeasurementTab, MeasurementField.tab_id == MeasurementTab.id)
        .where(
            MeasurementTab.company_id == company.id,
            MeasurementTab.enabled.is_(True),
            MeasurementField.enabled.is_(True),
        )
    )
    valid_fields = {field.id: (field, tab) for field, tab in config_result.all()}
    submitted_values = {item.field_id: item.value for item in data.measurements}
    if len(submitted_values) != len(data.measurements):
        raise HTTPException(status_code=400, detail="A measurement field may only be submitted once")
    for field, _ in valid_fields.values():
        if field.required and not (submitted_values.get(field.id) or "").strip():
            raise HTTPException(status_code=400, detail=f"{field.name} is required")

    for meas_data in data.measurements:
        configured = valid_fields.get(meas_data.field_id)
        if configured is None or configured[1].id != meas_data.tab_id:
            raise HTTPException(status_code=400, detail="Measurement field is not valid for this company")

    if data.customer_id and data.customer:
        raise HTTPException(status_code=400, detail="Choose an existing customer or provide new customer details")

    customer: Optional[Customer] = None
    if data.customer_id:
        customer = (
            await db.execute(
                select(Customer).where(
                    Customer.id == data.customer_id,
                    Customer.company_id == company.id,
                )
            )
        ).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")
    elif data.customer is not None:
        customer = (
            await db.execute(
                select(Customer).where(
                    Customer.company_id == company.id,
                    Customer.phone_number == data.customer.phone_number,
                )
            )
        ).scalar_one_or_none()
        if customer is None:
            customer = Customer(
                company_id=company.id,
                name=data.customer.name,
                phone_number=data.customer.phone_number,
                address=data.customer.address,
                notes=data.customer.notes,
            )
            db.add(customer)
            await db.flush()
    else:
        raise HTTPException(status_code=400, detail="Select a customer or enter new customer details")

    if customer is None:
        raise HTTPException(status_code=400, detail="A customer is required")
    if data.order_number is None:
        numbering = await lock_order_document_numbering(db, company.id)
        order_number = await allocate_order_number(db, company.id, numbering)
    else:
        order_number = data.order_number.strip()
    duplicate_order_number = await db.execute(
        select(Order.id).where(
            Order.company_id == company.id,
            Order.order_number == order_number,
        )
    )
    if duplicate_order_number.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Order number already exists")

    order = Order(
        company_id=company.id,
        order_number=order_number,
        order_date=data.order_date or datetime.now(timezone.utc),
        customer_id=customer.id,
        created_by_id=current_user.id,
        due_date=data.due_date,
        priority=data.priority,
        status=OrderStatusSchema.ORDER_RECEIVED.value,
    )
    db.add(order)
    await db.flush()

    status_history = OrderStatusHistory(
        order_id=order.id,
        changed_by_id=current_user.id,
        old_status="",
        new_status=OrderStatusSchema.ORDER_RECEIVED.value,
        reason="Order created",
    )
    db.add(status_history)

    measurement_values = {measurement.field_id: measurement.value for measurement in data.measurements}
    try:
        await save_order_measurements(
            db,
            order,
            company.id,
            measurement_values,
        )
        await save_customer_measurements(
            db,
            customer,
            company.id,
            measurement_values,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    await db.commit()

    await log_audit_event(
        db, company_id=company.id, action="order.created",
        entity_type="order", entity_id=order.id,
        details={"order_number": order.order_number, "customer_id": customer.id}
    )

    return await _get_order_out(db, company.id, order.id)


@router.get("", response_model=List[OrderListOut])
async def list_orders(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """List orders for current company with optional filtering."""
    company, _ = tenant

    stmt = select(Order).where(Order.company_id == company.id)

    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if customer_id:
        stmt = stmt.where(Order.customer_id == customer_id)
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Order.order_number.ilike(search_pattern),
                Order.customer.has(
                    or_(
                        Customer.name.ilike(search_pattern),
                        Customer.phone_number.ilike(search_pattern),
                    )
                ),
            )
        )

    result = await db.execute(
        stmt.options(selectinload(Order.customer)).order_by(Order.created_at.desc())
    )
    now = datetime.now(timezone.utc)
    orders = result.scalars().all()
    output = []
    for order in orders:
        due_date = order.due_date
        if due_date is not None and due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        output.append(OrderListOut(
            id=order.id,
            company_id=order.company_id,
            order_number=order.order_number,
            order_date=order.order_date,
            status=order.status,
            due_date=order.due_date,
            priority=order.priority,
            created_at=order.created_at,
            customer_name=order.customer.name,
            customer_phone=order.customer.phone_number,
            is_overdue=(
                due_date is not None
                and due_date < now
                and order.status not in {"delivered", "cancelled"}
            ),
        ))
    return output


@router.get("/upcoming", response_model=List[OrderListOut])
async def list_upcoming_orders(
    timezone_name: str = Query(..., alias="timezone", min_length=1, max_length=100),
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """List non-terminal orders due within the next five local calendar days."""
    company, _ = tenant
    try:
        local_timezone = ZoneInfo(timezone_name)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise HTTPException(status_code=400, detail="Invalid timezone") from error

    today = datetime.now(local_timezone).date()
    start_local = datetime.combine(today, time.min, tzinfo=local_timezone)
    end_local = datetime.combine(today + timedelta(days=5), time.min, tzinfo=local_timezone)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Order)
        .where(
            Order.company_id == company.id,
            Order.due_date >= start_utc,
            Order.due_date < end_utc,
            Order.status.not_in({"delivered", "cancelled"}),
        )
        .options(selectinload(Order.customer))
        .order_by(asc(Order.due_date))
    )
    output = []
    for order in result.scalars().all():
        due_date = order.due_date
        if due_date is not None and due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        output.append(OrderListOut(
            id=order.id,
            company_id=order.company_id,
            order_number=order.order_number,
            order_date=order.order_date,
            status=order.status,
            due_date=order.due_date,
            priority=order.priority,
            created_at=order.created_at,
            customer_name=order.customer.name,
            customer_phone=order.customer.phone_number,
            is_overdue=due_date is not None and due_date < now,
        ))
    return output


@router.get("/measurement-config", response_model=List[MeasurementTabOut])
async def get_measurement_config(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Return this company's measurement tabs and fields."""
    company, _ = tenant
    result = await db.execute(
        select(MeasurementTab)
        .where(MeasurementTab.company_id == company.id)
        .options(selectinload(MeasurementTab.fields))
        .order_by(MeasurementTab.order, MeasurementTab.name)
    )
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Get order details."""
    company, _ = tenant

    return await _get_order_out(db, company.id, order_id)


@router.patch("/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: str,
    data: OrderUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Update editable order identifiers and dates."""
    company, _ = tenant

    result = await db.execute(select(Order).where(Order.id == order_id, Order.company_id == company.id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if data.order_number is not None and data.order_number != order.order_number:
        duplicate = await db.execute(
            select(Order.id).where(
                Order.company_id == company.id,
                Order.order_number == data.order_number,
                Order.id != order.id,
            )
        )
        if duplicate.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Order number already exists")
        order.order_number = data.order_number
    if data.order_date is not None:
        order.order_date = data.order_date
    if "due_date" in data.model_fields_set:
        order.due_date = data.due_date
    if data.priority is not None:
        order.priority = data.priority
    if data.measurements is not None:
        measurement_dict = {m.field_id: m.value for m in data.measurements}
        try:
            await save_order_measurements(db, order, company.id, measurement_dict)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
    await db.commit()

    await log_audit_event(
        db, company_id=company.id, action="order.updated",
        entity_type="order", entity_id=order.id,
        details={
            "order_number": order.order_number,
            "order_date": order.order_date.isoformat(),
            "priority": order.priority,
        }
    )

    return await _get_order_out(db, company.id, order.id)


@router.put("/{order_id}/measurements", response_model=List[OrderMeasurementOut])
async def update_order_measurements(
    order_id: str,
    data: List[CustomerMeasurementInput],
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Update measurements for this specific order only (historical snapshot)."""
    company, _ = tenant
    order = (
        await db.execute(
            select(Order).where(
                Order.id == order_id,
                Order.company_id == company.id,
            )
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    values = {item.field_id: item.value for item in data}
    if len(values) != len(data):
        raise HTTPException(status_code=400, detail="A measurement field may only be submitted once")
    try:
        measurements = await save_order_measurements(db, order, company.id, values)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await db.commit()
    return measurements


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.company_id == company.id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"delivered", "cancelled"}:
        raise HTTPException(status_code=400, detail="This order is already closed")

    next_status = data.status.value
    if next_status == "cancelled":
        reason = (data.reason or "").strip()
        if not reason:
            raise HTTPException(status_code=400, detail="A cancellation reason is required")
    else:
        try:
            current_position = next(
                index for index, item in enumerate(ORDER_STATUS_SEQUENCE)
                if item.value == order.status
            )
            next_position = next(
                index for index, item in enumerate(ORDER_STATUS_SEQUENCE)
                if item.value == next_status
            )
        except StopIteration as error:
            raise HTTPException(status_code=400, detail="Order has an invalid status") from error
        if next_position != current_position + 1:
            raise HTTPException(
                status_code=400,
                detail="Orders must move through each status in sequence",
            )
        reason = data.reason.strip() if data.reason else None

    old_status = order.status
    order.status = next_status
    db.add(OrderStatusHistory(
        order_id=order.id,
        changed_by_id=current_user.id,
        old_status=old_status,
        new_status=next_status,
        reason=reason,
    ))
    await db.commit()
    await log_audit_event(
        db,
        company_id=company.id,
        action="order.status_updated",
        entity_type="order",
        entity_id=order.id,
        user_id=current_user.id,
        details={"old_status": old_status, "new_status": next_status, "reason": reason},
    )
    return await _get_order_out(db, company.id, order.id)


# ============ Measurement Tab Endpoints ============

@router.post("/measurement-config/tabs", response_model=MeasurementTabOut, status_code=status.HTTP_201_CREATED)
async def create_measurement_tab(
    data: MeasurementTabCreate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Create a new measurement tab (owner/admin only)."""
    company, _ = tenant

    # Check if tab name already exists for this company
    existing = await db.execute(
        select(MeasurementTab).where(
            MeasurementTab.company_id == company.id,
            MeasurementTab.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Measurement tab with this name already exists")

    max_order_result = await db.execute(
        select(func.max(MeasurementTab.order)).where(MeasurementTab.company_id == company.id)
    )
    max_order = max_order_result.scalar() or 0

    tab = MeasurementTab(
        company_id=company.id,
        name=data.name,
        order=max_order + 1,
        enabled=data.enabled if data.enabled is not None else True
    )
    db.add(tab)
    await db.flush()

    if data.fields:
        for idx, f_data in enumerate(data.fields):
            field = MeasurementField(
                tab_id=tab.id,
                name=f_data.name,
                field_type=f_data.field_type,
                unit=f_data.unit,
                required=f_data.required,
                order=idx
            )
            db.add(field)

    await db.commit()

    result = await db.execute(
        select(MeasurementTab)
        .where(MeasurementTab.id == tab.id)
        .options(selectinload(MeasurementTab.fields))
    )
    return result.scalar_one()


@router.get("/measurement-config/tabs", response_model=List[MeasurementTabOut])
async def list_measurement_tabs(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """List measurement tabs for current company."""
    company, _ = tenant

    result = await db.execute(
        select(MeasurementTab)
        .where(MeasurementTab.company_id == company.id)
        .options(selectinload(MeasurementTab.fields))
        .order_by(MeasurementTab.order, MeasurementTab.name)
    )
    return result.scalars().all()


@router.put("/measurement-config/tabs/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_measurement_tabs(
    data: MeasurementTabOrderUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Reorder measurement tabs (owner/admin only)."""
    company, _ = tenant
    company_tabs = (
        await db.execute(
            select(MeasurementTab.id).where(
                MeasurementTab.id.in_(data.tab_ids),
                MeasurementTab.company_id == company.id,
            )
        )
    ).scalars().all()
    if len(set(company_tabs)) != len(data.tab_ids):
        raise HTTPException(status_code=400, detail="Invalid tab ids for this company")

    for idx, tab_id in enumerate(data.tab_ids):
        await db.execute(
            update(MeasurementTab)
            .where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
            .values(order=idx)
        )
    await db.commit()


@router.put("/measurement-config/tabs/{tab_id}/fields/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_measurement_fields(
    tab_id: str,
    data: MeasurementFieldOrderUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Reorder fields within a tab (owner/admin only)."""
    company, _ = tenant
    tab_res = await db.execute(
        select(MeasurementTab).where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
    )
    if not tab_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Measurement tab not found")

    tab_fields = (
        await db.execute(
            select(MeasurementField.id).where(
                MeasurementField.id.in_(data.field_ids),
                MeasurementField.tab_id == tab_id,
            )
        )
    ).scalars().all()
    if len(set(tab_fields)) != len(data.field_ids):
        raise HTTPException(status_code=400, detail="Invalid field ids for this tab")

    for idx, field_id in enumerate(data.field_ids):
        await db.execute(
            update(MeasurementField)
            .where(MeasurementField.id == field_id, MeasurementField.tab_id == tab_id)
            .values(order=idx)
        )
    await db.commit()


@router.get("/measurement-config/tabs/{tab_id}", response_model=MeasurementTabOut)
async def get_measurement_tab(
    tab_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Get measurement tab details."""
    company, _ = tenant

    result = await db.execute(
        select(MeasurementTab)
        .where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
        .options(selectinload(MeasurementTab.fields))
    )
    tab = result.scalar_one_or_none()

    if not tab:
        raise HTTPException(status_code=404, detail="Measurement tab not found")

    return tab


@router.patch("/measurement-config/tabs/{tab_id}", response_model=MeasurementTabOut)
async def update_measurement_tab(
    tab_id: str,
    data: MeasurementTabUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Update measurement tab (owner/admin only)."""
    company, _ = tenant

    result = await db.execute(
        select(MeasurementTab)
        .where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
        .options(selectinload(MeasurementTab.fields))
    )
    tab = result.scalar_one_or_none()

    if not tab:
        raise HTTPException(status_code=404, detail="Measurement tab not found")

    if data.name is not None:
        existing = await db.execute(
            select(MeasurementTab).where(
                MeasurementTab.company_id == company.id,
                MeasurementTab.name == data.name,
                MeasurementTab.id != tab_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Measurement tab with this name already exists")
        tab.name = data.name

    if data.enabled is not None:
        tab.enabled = data.enabled
    if data.order is not None:
        tab.order = data.order

    await db.commit()
    await db.refresh(tab)

    return tab


@router.delete("/measurement-config/tabs/{tab_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_measurement_tab(
    tab_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Delete measurement tab (owner/admin only)."""
    company, _ = tenant

    result = await db.execute(
        select(MeasurementTab).where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
    )
    tab = result.scalar_one_or_none()
    if not tab:
        raise HTTPException(status_code=404, detail="Measurement tab not found")

    await db.delete(tab)
    await db.commit()


@router.post("/measurement-config/tabs/{tab_id}/fields", response_model=MeasurementFieldOut, status_code=status.HTTP_201_CREATED)
async def create_measurement_field(
    tab_id: str,
    data: MeasurementFieldCreate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Create a new measurement field (owner/admin only)."""
    company, _ = tenant

    tab_result = await db.execute(
        select(MeasurementTab).where(MeasurementTab.id == tab_id, MeasurementTab.company_id == company.id)
    )
    if not tab_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Measurement tab not found")

    max_order_result = await db.execute(
        select(func.max(MeasurementField.order)).where(MeasurementField.tab_id == tab_id)
    )
    max_order = max_order_result.scalar() or 0

    field = MeasurementField(
        tab_id=tab_id,
        name=data.name,
        field_type=data.field_type,
        unit=data.unit,
        required=data.required,
        order=max_order + 1
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)

    return field


@router.patch("/measurement-config/fields/{field_id}", response_model=MeasurementFieldOut)
async def update_measurement_field(
    field_id: str,
    data: MeasurementFieldUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Update measurement field (owner/admin only)."""
    company, _ = tenant

    result = await db.execute(
        select(MeasurementField)
        .join(MeasurementTab, MeasurementField.tab_id == MeasurementTab.id)
        .where(MeasurementField.id == field_id, MeasurementTab.company_id == company.id)
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(status_code=404, detail="Measurement field not found")

    if data.name is not None:
        field.name = data.name
    if data.field_type is not None:
        field.field_type = data.field_type
    if data.unit is not None:
        field.unit = data.unit
    if data.required is not None:
        field.required = data.required
    if data.enabled is not None:
        field.enabled = data.enabled

    await db.commit()
    await db.refresh(field)

    return field
