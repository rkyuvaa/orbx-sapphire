from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ActivationRequest(BaseModel):
    token: str
    full_name: Optional[str] = None
    password: str = Field(..., min_length=8)

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class UserMembershipSummary(BaseModel):
    id: str
    company_id: str
    company_name: str
    company_code: str
    company_status: str
    role: str
    status: str

class AuthUser(BaseModel):
    id: str
    email: str
    full_name: str
    is_superadmin: bool
    is_active: bool
    memberships: List[UserMembershipSummary] = []

    model_config = ConfigDict(from_attributes=True)
