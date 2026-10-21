from datetime import datetime, timezone
from typing import Optional, List
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.customer_measurements import save_customer_measurements
from app.core.deps import get_current_user, get_tenant_context, require_company_roles
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.order import Customer, CustomerMeasurement, Order
from app.schemas.order import (
    CustomerCreate, CustomerMeasurementInput, CustomerMeasurementOut, CustomerUpdate, CustomerOut,
)

router = APIRouter(prefix="/orders", tags=["Orders & Customers"])


@router.get("/customers", response_model=List[CustomerOut])
async def list_customers(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None, min_length=3),
    limit: Optional[int] = Query(None, ge=1, le=100),
):
    """List customers for current company, optionally filtered by search (name or phone)."""
    company, _ = tenant

    stmt = select(Customer).where(Customer.company_id == company.id).order_by(Customer.name)

    if search:
        search_pattern = f"%{search.lower()}%"
        normalized_phone_search = re.sub(r"[\s().-]", "", search)
        phone_search_pattern = f"%{normalized_phone_search}%"
        stmt = stmt.where(
            or_(
                func.lower(Customer.name).ilike(search_pattern),
                Customer.phone_number.ilike(search_pattern),
                Customer.phone_number.ilike(phone_search_pattern),
            )
        )

    if limit is not None:
        stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Create a new customer for current company."""
    company, _ = tenant
    # Check for existing customer with same phone number
    existing = await db.execute(
        select(Customer).where(
            Customer.company_id == company.id,
            Customer.phone_number == data.phone_number
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Customer with this phone number already exists")

    customer = Customer(
        company_id=company.id,
        name=data.name,
        phone_number=data.phone_number,
        address=data.address,
        notes=data.notes
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    await log_audit_event(
        db, company_id=company.id, action="customer.created",
        entity_type="customer", entity_id=customer.id,
        details={"name": customer.name, "phone": customer.phone_number}
    )

    return customer


@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Get customer details."""
    company, _ = tenant

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


@router.get(
    "/customers/{customer_id}/measurements",
    response_model=List[CustomerMeasurementOut],
)
async def get_customer_measurements(
    customer_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    customer = (
        await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.company_id == company.id,
            )
        )
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return (
        await db.execute(
            select(CustomerMeasurement)
            .where(CustomerMeasurement.customer_id == customer.id)
            .order_by(CustomerMeasurement.tab_name, CustomerMeasurement.field_name)
        )
    ).scalars().all()


@router.put(
    "/customers/{customer_id}/measurements",
    response_model=List[CustomerMeasurementOut],
)
async def update_customer_measurements(
    customer_id: str,
    data: List[CustomerMeasurementInput],
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    customer = (
        await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.company_id == company.id,
            )
        )
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    values = {item.field_id: item.value for item in data}
    if len(values) != len(data):
        raise HTTPException(status_code=400, detail="A measurement field may only be submitted once")
    try:
        measurements = await save_customer_measurements(db, customer, company.id, values)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await db.commit()
    return measurements


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Update customer details."""
    company, _ = tenant

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if data.name is not None:
        customer.name = data.name
    if data.phone_number is not None:
        # Check for duplicate phone number
        existing = await db.execute(
            select(Customer).where(
                Customer.company_id == company.id,
                Customer.phone_number == data.phone_number,
                Customer.id != customer_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer with this phone number already exists")

    if data.address is not None:
        customer.address = data.address
    if data.notes is not None:
        customer.notes = data.notes

    await db.commit()
    await db.refresh(customer)

    await log_audit_event(
        db, company_id=company.id, action="customer.updated",
        entity_type="customer", entity_id=customer.id,
        details={"name": customer.name, "phone": customer.phone_number}
    )

    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Delete customer from company."""
    company, _ = tenant

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    has_orders = await db.scalar(
        select(Order.id).where(Order.customer_id == customer.id).limit(1)
    )
    has_measurements = await db.scalar(
        select(CustomerMeasurement.id)
        .where(CustomerMeasurement.customer_id == customer.id)
        .limit(1)
    )
    if has_orders or has_measurements:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer cannot be deleted while orders or saved measurements are linked.",
        )

    await db.delete(customer)
    await db.commit()

    await log_audit_event(
        db, company_id=company.id, action="customer.deleted",
        entity_type="customer", entity_id=customer.id
    )