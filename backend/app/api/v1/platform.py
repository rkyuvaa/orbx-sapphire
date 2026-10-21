from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import hashlib

from app.core.database import get_db
from app.core.security import generate_secure_token, get_password_hash
from app.core.audit import log_audit_event
from app.core.deps import get_current_superadmin, get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.subscription import SubscriptionPlan, CompanySubscription
from app.models.invitation import Invitation
from app.models.audit import AuditLog
from app.models.order import Order, OrderDocumentNumbering
from app.schemas.company import (
    CompanyOut,
    CompanyCreate,
    CompanyUpdate,
    CompanyStatusUpdate,
    CompanyWithOwnerProvisionedOut,
    ResetOwnerPasswordRequest,
    ReminderSettingsOut,
    ReminderSettingsUpdate,
)
from app.schemas.subscription import SubscriptionPlanOut, SubscriptionPlanCreate, SubscriptionPlanUpdate
from app.schemas.audit import AuditLogOut
from app.schemas.platform import PlatformDashboardStats

router = APIRouter(prefix="/platform", tags=["Platform Super Admin"])

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

@router.get("/dashboard", response_model=PlatformDashboardStats)
async def get_platform_dashboard(
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    # Total companies & breakdowns
    total_comp_res = await db.execute(select(func.count(Company.id)))
    total_companies = total_comp_res.scalar() or 0

    active_comp_res = await db.execute(select(func.count(Company.id)).where(Company.status == "active"))
    active_companies = active_comp_res.scalar() or 0

    suspended_comp_res = await db.execute(select(func.count(Company.id)).where(Company.status == "suspended"))
    suspended_companies = suspended_comp_res.scalar() or 0

    pending_comp_res = await db.execute(select(func.count(Company.id)).where(Company.status == "pending_activation"))
    pending_companies = pending_comp_res.scalar() or 0

    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    # Plan distribution
    plan_stmt = (
        select(SubscriptionPlan.name, func.count(CompanySubscription.id))
        .outerjoin(CompanySubscription, CompanySubscription.plan_id == SubscriptionPlan.id)
        .group_by(SubscriptionPlan.name)
    )
    plan_rows = (await db.execute(plan_stmt)).all()
    plan_distribution = {name: count for name, count in plan_rows}

    # Recent platform activities
    audit_stmt = (
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    recent_audits = (await db.execute(audit_stmt)).scalars().all()
    audit_outs = []
    for a in recent_audits:
        audit_outs.append(AuditLogOut(
            id=a.id,
            user_id=a.user_id,
            company_id=a.company_id,
            action=a.action,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            ip_address=a.ip_address,
            user_agent=a.user_agent,
            details=a.details,
            created_at=a.created_at,
            user_email=a.user.email if a.user else None,
            company_name=a.company.name if a.company else None
        ))

    return PlatformDashboardStats(
        total_companies=total_companies,
        active_companies=active_companies,
        suspended_companies=suspended_companies,
        pending_companies=pending_companies,
        total_users=total_users,
        plan_distribution=plan_distribution,
        recent_activities=audit_outs
    )

@router.get("/companies", response_model=List[CompanyOut])
async def list_companies(
    query: Optional[str] = Query(None, description="Search by name, code or contact email"),
    status: Optional[str] = Query(None, description="Filter by status: active, suspended, pending_activation"),
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Company)
        .options(
            selectinload(Company.owner),
            selectinload(Company.subscription).selectinload(CompanySubscription.plan)
        )
        .order_by(Company.created_at.desc())
    )

    if status:
        stmt = stmt.where(Company.status == status)

    if query:
        q = f"%{query.lower().strip()}%"
        stmt = stmt.where(
            or_(
                func.lower(Company.name).like(q),
                func.lower(Company.code).like(q),
                func.lower(Company.contact_email).like(q)
            )
        )

    res = await db.execute(stmt)
    companies = res.scalars().all()

    outs = []
    for c in companies:
        mem_count_res = await db.execute(
            select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == c.id)
        )
        member_count = mem_count_res.scalar() or 0

        c_out = CompanyOut.model_validate(c)
        c_out.member_count = member_count
        outs.append(c_out)

    return outs

@router.post("/companies", response_model=CompanyWithOwnerProvisionedOut, status_code=status.HTTP_201_CREATED)
async def create_company_with_owner_provisioning(
    payload: CompanyCreate,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    # 1. Check unique company code
    code_clean = payload.code.lower().strip()
    existing_code = await db.execute(select(Company).where(Company.code == code_clean))
    if existing_code.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company code '{code_clean}' is already in use. Please choose another identifier."
        )

    # 2. Check or create owner account
    owner_email_clean = payload.owner_email.lower().strip()
    user_res = await db.execute(select(User).where(User.email == owner_email_clean))
    owner_user = user_res.scalar_one_or_none()

    is_new_user = False
    if not owner_user:
        is_new_user = True
        direct_pwd = payload.owner_password if (payload.owner_password and len(payload.owner_password) >= 8) else None
        hashed = get_password_hash(direct_pwd or generate_secure_token())
        owner_user = User(
            email=owner_email_clean,
            full_name=payload.owner_name.strip(),
            hashed_password=hashed,
            is_active=bool(direct_pwd),
            is_superadmin=False
        )
        db.add(owner_user)
        await db.flush()
    elif payload.owner_password and len(payload.owner_password) >= 8:
        owner_user.hashed_password = get_password_hash(payload.owner_password)
        owner_user.is_active = True

    # 3. Create Company Record
    # New companies are marked 'pending_activation' until the owner activates, or 'active' if owner already active
    initial_status = "active" if owner_user.is_active else "pending_activation"
    company = Company(
        name=payload.name.strip(),
        code=code_clean,
        status=initial_status,
        owner_id=owner_user.id,
        gst_number=payload.gst_number.strip().upper() if payload.gst_number else None,
        address=payload.address.strip() if payload.address else None,
        contact_email=payload.contact_email or owner_email_clean,
        contact_phone=payload.contact_phone,
        website=payload.website.strip() if payload.website else None,
        settings=payload.settings or {}
    )
    db.add(company)
    await db.flush()
    db.add(OrderDocumentNumbering(company_id=company.id))

    # 4. Create Company Membership with 'owner' role
    membership = CompanyMembership(
        user_id=owner_user.id,
        company_id=company.id,
        role="owner",
        status="active" if owner_user.is_active else "inactive"
    )
    db.add(membership)

    # 5. Assign Subscription Plan
    plan = None
    if payload.plan_id:
        plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id))
        plan = plan_res.scalar_one_or_none()

    if not plan:
        # Default to first active plan or create Starter Plan
        plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True))
        plan = plan_res.scalars().first()
        if not plan:
            plan = SubscriptionPlan(
                code="starter",
                name="Starter Plan",
                description="Default tier for newly provisioned workshops",
                max_users=5,
                modules_allowed={"orders": True, "inventory": True, "team": True}
            )
            db.add(plan)
            await db.flush()

    subscription = CompanySubscription(
        company_id=company.id,
        plan_id=plan.id,
        status="active",
        started_at=datetime.now(timezone.utc)
    )
    db.add(subscription)

    # 6. Generate secure activation/invitation token
    raw_token = generate_secure_token()
    token_h = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = Invitation(
        email=owner_email_clean,
        company_id=company.id,
        role="owner",
        token_hash=token_h,
        invited_by_id=current_superadmin.id,
        expires_at=expires_at
    )
    db.add(invitation)

    await db.commit()
    await db.refresh(company)

    # 7. Audit Log
    await log_audit_event(
        db,
        action="company.created",
        entity_type="company",
        entity_id=company.id,
        user_id=current_superadmin.id,
        company_id=company.id,
        details={
            "company_name": company.name,
            "company_code": company.code,
            "owner_email": owner_email_clean,
            "plan_code": plan.code
        },
        request=request
    )

    company_out = CompanyOut.model_validate(company)
    company_out.member_count = 1

    activation_url = f"/activate?token={raw_token}"

    return CompanyWithOwnerProvisionedOut(
        company=company_out,
        invitation_token=raw_token,
        activation_url=activation_url,
        message="Company created and owner activation invitation provisioned successfully."
    )

@router.get("/companies/{company_id}", response_model=CompanyOut)
async def get_company_detail(
    company_id: str,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Company)
        .options(
            selectinload(Company.owner),
            selectinload(Company.subscription).selectinload(CompanySubscription.plan)
        )
        .where(Company.id == company_id)
    )
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    mem_count_res = await db.execute(
        select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == company.id)
    )
    member_count = mem_count_res.scalar() or 0

    c_out = CompanyOut.model_validate(company)
    c_out.member_count = member_count
    return c_out

@router.patch("/companies/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: str,
    payload: CompanyUpdate,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Company)
        .options(
            selectinload(Company.owner),
            selectinload(Company.subscription).selectinload(CompanySubscription.plan)
        )
        .where(Company.id == company_id)
    )
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

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
    if payload.plan_id:
        sub_stmt = select(CompanySubscription).where(CompanySubscription.company_id == company.id)
        sub_res = await db.execute(sub_stmt)
        sub = sub_res.scalar_one_or_none()
        if sub:
            sub.plan_id = payload.plan_id
        else:
            db.add(CompanySubscription(company_id=company.id, plan_id=payload.plan_id, status="active"))

    await db.commit()
    await db.refresh(company)

    await log_audit_event(
        db,
        action="company.updated",
        entity_type="company",
        entity_id=company.id,
        user_id=current_superadmin.id,
        company_id=company.id,
        details=payload.model_dump(exclude_unset=True),
        request=request
    )

    return CompanyOut.model_validate(company)

@router.post("/companies/{company_id}/status", response_model=CompanyOut)
async def update_company_status(
    company_id: str,
    payload: CompanyStatusUpdate,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Company)
        .options(
            selectinload(Company.owner),
            selectinload(Company.subscription).selectinload(CompanySubscription.plan)
        )
        .where(Company.id == company_id)
    )
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    prev_status = company.status
    company.status = payload.status
    await db.commit()
    await db.refresh(company)

    await log_audit_event(
        db,
        action=f"company.status_changed",
        entity_type="company",
        entity_id=company.id,
        user_id=current_superadmin.id,
        company_id=company.id,
        details={
            "previous_status": prev_status,
            "new_status": payload.status,
            "reason": payload.reason
        },
        request=request
    )

    return CompanyOut.model_validate(company)

@router.get("/plans", response_model=List[SubscriptionPlanOut])
async def list_plans(
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SubscriptionPlan).order_by(SubscriptionPlan.created_at.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/plans", response_model=SubscriptionPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: SubscriptionPlanCreate,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    plan = SubscriptionPlan(
        code=payload.code.lower().strip(),
        name=payload.name.strip(),
        description=payload.description,
        max_users=payload.max_users,
        modules_allowed=payload.modules_allowed,
        is_active=payload.is_active
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan

@router.patch("/plans/{plan_id}", response_model=SubscriptionPlanOut)
async def update_plan(
    plan_id: str,
    payload: SubscriptionPlanUpdate,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    res = await db.execute(stmt)
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription plan not found")

    if payload.name is not None:
        plan.name = payload.name.strip()
    if payload.description is not None:
        plan.description = payload.description.strip()
    if payload.max_users is not None:
        plan.max_users = payload.max_users
    if payload.modules_allowed is not None:
        plan.modules_allowed = payload.modules_allowed
    if payload.is_active is not None:
        plan.is_active = payload.is_active

    await db.commit()
    await db.refresh(plan)

    await log_audit_event(
        db,
        action="plan.updated",
        entity_type="subscription_plan",
        entity_id=plan.id,
        user_id=current_superadmin.id,
        details=payload.model_dump(exclude_unset=True),
        request=request
    )

    return plan

@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: str,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    res = await db.execute(stmt)
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription plan not found")

    sub_count_res = await db.execute(
        select(func.count(CompanySubscription.id)).where(CompanySubscription.plan_id == plan_id)
    )
    assigned_count = sub_count_res.scalar() or 0
    if assigned_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete plan '{plan.name}' because {assigned_count} company subscription(s) are currently assigned to it. Please reassign those companies first or mark the plan as inactive."
        )

    plan_name = plan.name
    plan_code = plan.code
    await db.delete(plan)
    await db.commit()

    await log_audit_event(
        db,
        action="plan.deleted",
        entity_type="subscription_plan",
        entity_id=plan_id,
        user_id=current_superadmin.id,
details={"plan_code": plan_code, "plan_name": plan_name},
        request=request
    )
@router.post("/companies/{company_id}/reset-owner-password")
async def reset_company_owner_password(
    company_id: str,
    payload: ResetOwnerPasswordRequest,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    if not company.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company has no assigned owner")

    owner_res = await db.execute(select(User).where(User.id == company.owner_id))
    owner = owner_res.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner user account not found")

    owner.hashed_password = get_password_hash(payload.new_password)
    owner.is_active = True
    company.status = "active"

    mem_res = await db.execute(
        select(CompanyMembership).where(
            CompanyMembership.user_id == owner.id,
            CompanyMembership.company_id == company.id
        )
    )
    mem = mem_res.scalar_one_or_none()
    if mem:
        mem.status = "active"

    await db.commit()

    await log_audit_event(
        db,
        action="company.owner_password_reset",
        entity_type="user",
        entity_id=owner.id,
        user_id=current_superadmin.id,
        company_id=company.id,
        details={"owner_email": owner.email},
        request=request
    )

    return {
        "message": f"Password updated for owner {owner.email}. The account is active and can log in immediately.",
        "owner_email": owner.email
    }


@router.get("/companies/{company_id}/reminder-settings", response_model=ReminderSettingsOut)
async def get_reminder_settings(
    company_id: str,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    settings = company.reminder_settings
    return ReminderSettingsOut(**settings)


@router.patch("/companies/{company_id}/reminder-settings", response_model=ReminderSettingsOut)
async def update_reminder_settings(
    company_id: str,
    payload: ReminderSettingsUpdate,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    
    settings = dict(company.settings or {})
    reminder_settings = {
        **company.reminder_settings,
        **payload.model_dump(exclude_unset=True, exclude_none=True),
    }
    settings['reminder'] = reminder_settings
    company.settings = settings
    
    await db.commit()
    await log_audit_event(
        db,
        action="company.reminder_settings_updated",
        entity_type="company",
        entity_id=company.id,
        user_id=current_superadmin.id,
        company_id=company.id,
        details={
            "updated_by": current_superadmin.email,
            "settings": payload.model_dump(exclude_unset=True, exclude_none=True),
        },
        request=request
    )
    return ReminderSettingsOut(**reminder_settings)


@router.post("/companies/{company_id}/test-reminder", response_model=dict)
async def test_reminder(
    company_id: str,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    
    settings = company.reminder_settings
    if not settings.get('enabled', True):
        return {"status": "disabled", "message": "Reminders are disabled"}
    
    priority = settings.get('high_priority_days', 15)
    recurring = settings.get('high_priority_recurring', 'daily')
    
    return {
        "status": "test_sent",
        "priority": f"{priority} days",
        "recurring": recurring,
        "message": "Reminder test configured"
    }


@router.post("/companies/{company_id}/send-reminder", response_model=dict)
async def send_company_reminder(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send reminders for overdue orders based on priority settings."""
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    
    # Check if user has permission (owner or manager)
    mem_res = await db.execute(
        select(CompanyMembership).where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.company_id == company_id
        )
    )
    membership = mem_res.scalar_one_or_none()
    if not membership or membership.role not in ['owner', 'manager']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    settings = company.reminder_settings
    if not settings.get('enabled', True):
        return {"status": "disabled", "message": "Reminders are disabled"}
    
    # Get overdue orders
    from sqlalchemy import select, func
    from datetime import datetime, timezone
    
    today = datetime.now(timezone.utc)
    
    # Get orders with their due dates based on priority
    stmt = select(Order).options(
        selectinload(Order.customer)
    ).where(
        Order.company_id == company_id,
        Order.status.in_(['order_received', 'material_marking', 'design_work', 'cutting', 'stitching', 'finishing', 'trial', 'ready_for_delivery'])
    )
    res = await db.execute(stmt)
    orders = res.scalars().all()
    
    sent_count = 0
    for order in orders:
        # Determine priority and days based on order or company default
        # For now, use company default reminder settings
        priority_days = settings.get('high_priority_days', 15)
        priority_recurring = settings.get('high_priority_recurring', 'daily')
        
        # Check if order is overdue based on priority days
        # orders created more than priority_days ago would be overdue
        if order.order_date:
            days_since_creation = (today - order.order_date.replace(tzinfo=timezone.utc)).days
            if days_since_creation >= priority_days and not order.is_overdue:
                # Send reminder notification
                user_ids = await db.execute(
                    select(CompanyMembership.user_id).where(
                        CompanyMembership.company_id == company_id,
                        CompanyMembership.role.in_(['owner', 'manager', 'staff'])
                    )
                )
                recipient_ids = user_ids.scalars().all()
                
                # Create notification for each recipient
                for user_id in recipient_ids:
                    await db.execute(
                        insert(AuditLog).values(
                            action="reminder.sent",
                            entity_type="order",
                            entity_id=order.id,
                            user_id=user_id,
                            company_id=company_id,
                            details={"order_id": order.id, "priority": f"{priority_days} days", "recurring": priority_recurring}
                        )
                    )
                    sent_count += 1
    
    await db.commit()
    
    return {
        "status": "reminders_sent",
        "count": sent_count,
        "priority": f"{priority_days} days",
        "recurring": priority_recurring
    }


@router.post("/companies/{company_id}/send-browser-notification", response_model=dict)
async def send_browser_notification(
    company_id: str,
    payload: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a browser notification to company users."""
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    
    # Check if user has permission
    mem_res = await db.execute(
        select(CompanyMembership).where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.company_id == company_id
        )
    )
    membership = mem_res.scalar_one_or_none()
    if not membership or membership.role not in ['owner', 'manager']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    message = payload.get('message', '')
    title = payload.get('title', 'OrbX Reminder')
    
    # Return success - frontend will handle the actual browser notification
    return {
        "status": "notification_queued",
        "message": message,
        "title": title,
        "company_id": company_id
    }


@router.get("/companies/{company_id}/activation-link")
async def get_company_activation_link(
    company_id: str,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    if not company.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company has no assigned owner")

    owner_res = await db.execute(select(User).where(User.id == company.owner_id))
    owner = owner_res.scalar_one_or_none()

    raw_token = generate_secure_token()
    token_h = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = Invitation(
        email=owner.email,
        company_id=company.id,
        role="owner",
        token_hash=token_h,
        invited_by_id=current_superadmin.id,
        expires_at=expires_at
    )
    db.add(invitation)
    await db.commit()

    return {
        "company_id": company.id,
        "company_name": company.name,
        "owner_email": owner.email,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}"
    }

@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: str,
    request: Request,
    current_superadmin: User = Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    company_name = company.name
    company_code = company.code

    await db.delete(company)
    await db.commit()

    await log_audit_event(
        db,
        action="company.deleted",
        entity_type="company",
        entity_id=company_id,
        user_id=current_superadmin.id,
        details={"name": company_name, "code": company_code},
        request=request
    )
