from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field("staff", pattern=r"^(owner|manager|staff)$")

class InvitationOut(BaseModel):
    id: str
    email: str
    company_id: Optional[str]
    role: str
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime
    invitation_token: Optional[str] = None
    activation_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class InvitationVerifyOut(BaseModel):
    valid: bool
    email: str
    role: str
    company_name: Optional[str] = None
    requires_password_setup: bool = True
