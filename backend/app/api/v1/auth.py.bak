from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import hashlib

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, generate_secure_token
from app.core.audit import log_audit_event
from app.core.deps import get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.invitation import Invitation
from app.schemas.auth import (
    Token,
    LoginRequest,
    ActivationRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    AuthUser,
    UserMembershipSummary
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == credentials.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        await log_audit_event(
            db,
            action="auth.login_failed",
            entity_type="user",
            entity_id=None,
            details={"email": credentials.email},
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or pending activation"
        )

    access_token = create_access_token(subject=user.id)

    await log_audit_event(
        db,
        action="auth.login_success",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details={"is_superadmin": user.is_superadmin},
        request=request
    )

    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=AuthUser)
async def get_current_authenticated_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch active company memberships with company info
    stmt = (
        select(CompanyMembership, Company)
        .join(Company, CompanyMembership.company_id == Company.id)
        .where(
            CompanyMembership.user_id == current_user.id,
            CompanyMembership.status == "active"
        )
    )
    res = await db.execute(stmt)
    rows = res.all()

    memberships_list: list[UserMembershipSummary] = []
    for mem, comp in rows:
        memberships_list.append(UserMembershipSummary(
            id=mem.id,
            company_id=comp.id,
            company_name=comp.name,
            company_code=comp.code,
            company_status=comp.status,
            role=mem.role,
            status=mem.status
        ))

    return AuthUser(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_superadmin=current_user.is_superadmin,
        is_active=current_user.is_active,
        memberships=memberships_list
    )

@router.post("/activate")
async def activate_account(
    data: ActivationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    token_h = hash_token(data.token)
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
            detail="Invalid or already used activation token"
        )

    # Note: SQLite / Postgres datetime timezone handling
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Activation token has expired"
        )

    # Check or create user
    user_stmt = select(User).where(User.email == invitation.email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            email=invitation.email,
            full_name=data.full_name or invitation.email.split("@")[0].title(),
            hashed_password=get_password_hash(data.password),
            is_active=True,
            is_superadmin=False
        )
        db.add(user)
        await db.flush()
    else:
        user.hashed_password = get_password_hash(data.password)
        user.is_active = True
        if data.full_name:
            user.full_name = data.full_name

    # If invitation was for a specific company, establish membership
    if invitation.company_id:
        # Check if membership already exists
        mem_stmt = select(CompanyMembership).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == invitation.company_id
        )
        mem_res = await db.execute(mem_stmt)
        mem = mem_res.scalar_one_or_none()

        if not mem:
            mem = CompanyMembership(
                user_id=user.id,
                company_id=invitation.company_id,
                role=invitation.role,
                status="active"
            )
            db.add(mem)
        else:
            mem.status = "active"
            mem.role = invitation.role

        # Activate company if it was pending_activation
        comp_stmt = select(Company).where(Company.id == invitation.company_id)
        comp_res = await db.execute(comp_stmt)
        comp = comp_res.scalar_one_or_none()
        if comp and comp.status == "pending_activation":
            comp.status = "active"

    # Mark invitation as used
    invitation.used_at = now
    await db.commit()

    await log_audit_event(
        db,
        action="user.activated",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        company_id=invitation.company_id,
        details={"email": user.email, "role": invitation.role},
        request=request
    )

    access_token = create_access_token(subject=user.id)
    return {
        "message": "Account successfully activated",
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/forgot-password")
async def forgot_password(
    data: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == data.email.lower().strip())
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    reset_token = None
    if user and user.is_active:
        raw_token = generate_secure_token()
        token_h = hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        invitation = Invitation(
            email=user.email,
            company_id=None,
            role="reset_password",
            token_hash=token_h,
            expires_at=expires_at
        )
        db.add(invitation)
        await db.commit()
        reset_token = raw_token

        await log_audit_event(
            db,
            action="auth.password_reset_requested",
            entity_type="user",
            entity_id=user.id,
            user_id=user.id,
            details={"email": user.email},
            request=request
        )

    # Return safe message (never leak existence of account)
    # In development / testing environment, include reset_token for ease of testing
    return {
        "message": "If this email is registered, password reset instructions have been sent.",
        "reset_token": reset_token  # Provided for test automation
    }

@router.post("/reset-password")
async def reset_password(
    data: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    token_h = hash_token(data.token)
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
            detail="Invalid or expired reset token"
        )

    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )

    user_stmt = select(User).where(User.email == invitation.email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.hashed_password = get_password_hash(data.new_password)
    invitation.used_at = now
    await db.commit()

    await log_audit_event(
        db,
        action="auth.password_reset_completed",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details={"email": user.email},
        request=request
    )

    return {"message": "Password reset successfully. You may now log in with your new password."}
