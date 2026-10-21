from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, get_tenant_context, require_company_roles
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.schemas.membership import MembershipOut, MembershipUpdate

router = APIRouter(prefix="/memberships", tags=["Company Memberships"])

@router.get("", response_model=List[MembershipOut])
async def list_company_members(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    company, _ = tenant
    stmt = (
        select(CompanyMembership)
        .where(CompanyMembership.company_id == company.id)
        .order_by(CompanyMembership.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.patch("/{member_id}", response_model=MembershipOut)
async def update_member_role_or_status(
    member_id: str,
    payload: MembershipUpdate,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company, current_membership = tenant

    stmt = select(CompanyMembership).where(
        CompanyMembership.id == member_id,
        CompanyMembership.company_id == company.id
    )
    res = await db.execute(stmt)
    target_mem = res.scalar_one_or_none()

    if not target_mem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this company")

    if target_mem.user_id == company.owner_id and payload.role and payload.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote the primary company owner"
        )

    prev_role = target_mem.role
    prev_status = target_mem.status

    if payload.role is not None:
        target_mem.role = payload.role
    if payload.status is not None:
        target_mem.status = payload.status

    await db.commit()
    await db.refresh(target_mem)

    await log_audit_event(
        db,
        action="member.updated",
        entity_type="membership",
        entity_id=target_mem.id,
        user_id=current_user.id,
        company_id=company.id,
        details={
            "target_user_id": target_mem.user_id,
            "old_role": prev_role,
            "new_role": target_mem.role,
            "old_status": prev_status,
            "new_status": target_mem.status
        },
        request=request
    )

    return target_mem

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member_from_company(
    member_id: str,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company, current_membership = tenant

    stmt = select(CompanyMembership).where(
        CompanyMembership.id == member_id,
        CompanyMembership.company_id == company.id
    )
    res = await db.execute(stmt)
    target_mem = res.scalar_one_or_none()

    if not target_mem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target_mem.user_id == company.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove primary company owner from company"
        )

    if target_mem.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself using this endpoint"
        )

    target_user_id = target_mem.user_id
    await db.delete(target_mem)
    await db.commit()

    await log_audit_event(
        db,
        action="member.removed",
        entity_type="membership",
        entity_id=member_id,
        user_id=current_user.id,
        company_id=company.id,
        details={"removed_user_id": target_user_id},
        request=request
    )
