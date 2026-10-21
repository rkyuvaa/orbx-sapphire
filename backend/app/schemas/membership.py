from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.schemas.user import UserOut

class MembershipBase(BaseModel):
    role: str = Field(..., pattern=r"^(owner|manager|staff)$")
    status: str = Field("active", pattern=r"^(active|inactive)$")

class MembershipCreate(MembershipBase):
    user_id: str

class MembershipUpdate(BaseModel):
    role: Optional[str] = Field(None, pattern=r"^(owner|manager|staff)$")
    status: Optional[str] = Field(None, pattern=r"^(active|inactive)$")

class MembershipOut(MembershipBase):
    id: str
    user_id: str
    company_id: str
    user: Optional[UserOut] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
