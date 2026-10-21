from typing import Optional, List
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, ConfigDict

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.subscription import CompanySubscription

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

class TenantContext(BaseModel):
    company: dict
    membership: dict
    user: dict

    model_config = ConfigDict(arbitrary_types_allowed=True)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    return user

async def get_current_superadmin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Super Admin access required"
        )
    return current_user

async def get_tenant_context(
    x_company_id: Optional[str] = Header(None, alias="X-Company-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> tuple[Company, CompanyMembership]:
    if not x_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required X-Company-ID header"
        )

    # 1. Fetch Company
    company_stmt = (
        select(Company)
        .options(
            selectinload(Company.owner),
            selectinload(Company.subscription).selectinload(CompanySubscription.plan)
        )
        .where(Company.id == x_company_id)
    )
    company_res = await db.execute(company_stmt)
    company = company_res.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # 2. Check Company Status
    if company.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This company account has been suspended. Please contact platform administration."
        )
    if company.status == "pending_activation":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This company is awaiting activation"
        )

    # 3. Verify Active Membership
    # Notice: Even a Super Admin must have an explicit membership to access company tenant endpoints
    mem_stmt = select(CompanyMembership).where(
        CompanyMembership.user_id == current_user.id,
        CompanyMembership.company_id == company.id,
        CompanyMembership.status == "active"
    )
    mem_res = await db.execute(mem_stmt)
    membership = mem_res.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an authorized member of this company workspace"
        )

    return company, membership

def require_company_roles(allowed_roles: List[str]):
    def role_checker(
        tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context)
    ) -> tuple[Company, CompanyMembership]:
        company, membership = tenant
        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {', '.join(allowed_roles)}"
            )
        return company, membership
    return role_checker
