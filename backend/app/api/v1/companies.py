from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, get_tenant_context, require_company_roles
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.order import OrderDocumentNumbering
from app.schemas.company import (
    CompanyOut,
    CompanyUpdate,
    OrderDocumentNumberingOut,
    OrderDocumentNumberingUpdate,
    ReminderSettingsOut,
    ReminderSettingsUpdate,
)
from app.schemas.auth import UserMembershipSummary

router = APIRouter(prefix="/companies", tags=["Companies & Workspaces"])


@router.get("/current/reminder-settings", response_model=ReminderSettingsOut)
async def get_current_reminder_settings(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
):
    company, _ = tenant
    return ReminderSettingsOut(**company.reminder_settings)


@router.patch("/current/reminder-settings", response_model=ReminderSettingsOut)
async def update_current_reminder_settings(
    payload: ReminderSettingsUpdate,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    reminder_settings = {
        **company.reminder_settings,
        **payload.model_dump(exclude_unset=True, exclude_none=True),
    }
    settings = dict(company.settings or {})
    settings["reminder"] = reminder_settings
    company.settings = settings
    await db.commit()
    await log_audit_event(
        db,
        action="company.reminder_settings_updated",
        entity_type="company",
        entity_id=company.id,
        user_id=current_user.id,
        company_id=company.id,
        details=payload.model_dump(exclude_unset=True, exclude_none=True),
        request=request,
    )
    return ReminderSettingsOut(**reminder_settings)


@router.get("/current/document-numbering", response_model=OrderDocumentNumberingOut)
async def get_order_document_numbering(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    numbering = (
        await db.execute(
            select(OrderDocumentNumbering).where(
                OrderDocumentNumbering.company_id == company.id
            )
        )
    ).scalar_one_or_none()
    if numbering is None:
        return OrderDocumentNumberingOut(prefix="ORD-", next_number=1)
    return numbering


@router.patch(
    "/current/document-numbering",
    response_model=OrderDocumentNumberingOut,
)
async def update_order_document_numbering(
    payload: OrderDocumentNumberingUpdate,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner"])),
    db: AsyncSession = Depends(get_db),
):
    company, _ = tenant
    numbering = (
        await db.execute(
            select(OrderDocumentNumbering)
            .where(OrderDocumentNumbering.company_id == company.id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if numbering is None:
        numbering = OrderDocumentNumbering(
            company_id=company.id,
            prefix=payload.prefix,
            next_number=payload.next_number,
        )
        db.add(numbering)
    else:
        numbering.prefix = payload.prefix
        numbering.next_number = payload.next_number
    await db.commit()
    await db.refresh(numbering)
    return numbering


@router.get("/my-companies", response_model=List[UserMembershipSummary])
async def get_my_companies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(CompanyMembership, Company)
        .join(Company, CompanyMembership.company_id == Company.id)
        .where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.status == "active"
        )
        .order_by(Company.name.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    return [
        UserMembershipSummary(
            id=mem.id,
            company_id=comp.id,
            company_name=comp.name,
            company_code=comp.code,
            company_status=comp.status,
            role=mem.role,
            status=mem.status
        )
        for mem, comp in rows
    ]

@router.get("/current", response_model=CompanyOut)
async def get_current_company_workspace(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    company, membership = tenant
    mem_count_res = await db.execute(
        select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == company.id)
    )
    member_count = mem_count_res.scalar() or 0

    c_out = CompanyOut.model_validate(company)
    c_out.member_count = member_count
    return c_out

@router.patch("/current", response_model=CompanyOut)
async def update_current_company_profile(
    payload: CompanyUpdate,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company, membership = tenant

    update_dict = payload.model_dump(exclude_unset=True)

    if "name" in update_dict and update_dict["name"]:
        company.name = update_dict["name"].strip()
    if "gst_number" in update_dict:
        val = update_dict["gst_number"]
        company.gst_number = val.strip().upper() if val and val.strip() else None
    if "address" in update_dict:
        val = update_dict["address"]
        company.address = val.strip() if val and val.strip() else None
    if "contact_email" in update_dict:
        val = update_dict["contact_email"]
        company.contact_email = val.strip() if val and val.strip() else None
    if "contact_phone" in update_dict:
        val = update_dict["contact_phone"]
        company.contact_phone = val.strip() if val and val.strip() else None
    if "website" in update_dict:
        val = update_dict["website"]
        company.website = val.strip() if val and val.strip() else None
    if "settings" in update_dict and update_dict["settings"] is not None:
        company.settings = update_dict["settings"]

    await db.commit()
    await db.refresh(company)

    await log_audit_event(
        db,
        action="company.profile_updated",
        entity_type="company",
        entity_id=company.id,
        user_id=current_user.id,
        company_id=company.id,
        details=payload.model_dump(exclude_unset=True),
        request=request
    )

    return CompanyOut.model_validate(company)
