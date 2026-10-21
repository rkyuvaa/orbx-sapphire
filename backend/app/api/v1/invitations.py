from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timezone, timedelta
import hashlib

from app.core.database import get_db
from app.core.security import generate_secure_token
from app.core.deps import get_current_user, get_tenant_context, require_company_roles
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.invitation import Invitation
from app.schemas.invitation import InvitationCreate, InvitationOut, InvitationVerifyOut

router = APIRouter(prefix="/invitations", tags=["Invitations"])

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

@router.post("", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    payload: InvitationCreate,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "manager"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company, current_membership = tenant
    email_clean = payload.email.lower().strip()

    # Check if user is already a member of this company
    existing_mem_stmt = (
        select(CompanyMembership)
        .join(User, CompanyMembership.user_id == User.id)
        .where(
            CompanyMembership.company_id == company.id,
            User.email == email_clean
        )
    )
    existing_mem = (await db.execute(existing_mem_stmt)).scalar_one_or_none()
    if existing_mem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{email_clean} is already a member of this company"
        )

    raw_token = generate_secure_token()
    token_h = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = Invitation(
        email=email_clean,
        company_id=company.id,
        role=payload.role,
        token_hash=token_h,
        invited_by_id=current_user.id,
        expires_at=expires_at
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    await log_audit_event(
        db,
        action="member.invited",
        entity_type="invitation",
        entity_id=invitation.id,
        user_id=current_user.id,
        company_id=company.id,
        details={"invited_email": email_clean, "role": payload.role},
        request=request
    )

    out = InvitationOut.model_validate(invitation)
    out.invitation_token = raw_token
    out.activation_url = f"/activate?token={raw_token}"
    return out

@router.get("", response_model=List[InvitationOut])
async def list_pending_invitations(
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "manager"])),
    db: AsyncSession = Depends(get_db)
):
    company, _ = tenant
    stmt = (
        select(Invitation)
        .where(
            Invitation.company_id == company.id,
            Invitation.used_at.is_(None)
        )
        .order_by(Invitation.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: str,
    request: Request,
    tenant: tuple[Company, CompanyMembership] = Depends(require_company_roles(["owner", "manager"])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company, _ = tenant
    stmt = select(Invitation).where(
        Invitation.id == invitation_id,
        Invitation.company_id == company.id
    )
    res = await db.execute(stmt)
    invitation = res.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    await db.delete(invitation)
    await db.commit()

    await log_audit_event(
        db,
        action="invitation.revoked",
        entity_type="invitation",
        entity_id=invitation_id,
        user_id=current_user.id,
        company_id=company.id,
        details={"email": invitation.email},
        request=request
    )

@router.get("/verify/{token}", response_model=InvitationVerifyOut)
async def verify_invitation_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    token_h = hash_token(token)
    now = datetime.now(timezone.utc)

    stmt = select(Invitation).where(
        Invitation.token_hash == token_h,
        Invitation.used_at.is_(None)
    )
    res = await db.execute(stmt)
    invitation = res.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token"
        )

    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation token has expired"
        )

    # Check if user already exists
    user_stmt = select(User).where(User.email == invitation.email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    company_name = None
    if invitation.company_id:
        comp_stmt = select(Company.name).where(Company.id == invitation.company_id)
        comp_res = await db.execute(comp_stmt)
        company_name = comp_res.scalar_one_or_none()

    return InvitationVerifyOut(
        valid=True,
        email=invitation.email,
        role=invitation.role,
        company_name=company_name,
        requires_password_setup=(user is None or not user.is_active)
    )
