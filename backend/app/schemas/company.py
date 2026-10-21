from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.schemas.user import UserOut
from app.schemas.subscription import CompanySubscriptionOut

class CompanyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9\-]+$")
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    settings: Dict[str, Any] = {}

class CompanyCreate(CompanyBase):
    owner_email: EmailStr
    owner_name: str = Field(..., min_length=2)
    owner_password: Optional[str] = None
    plan_id: Optional[str] = None

class ResetOwnerPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    plan_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

    @field_validator("contact_email", mode="before")
    @classmethod
    def validate_contact_email(cls, v):
        if v is None:
            return None
        s = str(v).strip().lower()
        return s if s else None

    @field_validator("gst_number", "address", "contact_phone", "website", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None


class ReminderSettingsOut(BaseModel):
    high_priority_days: int
    high_priority_recurring: str
    normal_priority_days: int
    normal_priority_recurring: str
    low_priority_days: int
    low_priority_recurring: str
    trigger_time: str = "09:00"
    timezone: str = "UTC"
    enabled: bool
    model_config = ConfigDict(from_attributes=True)


class ReminderSettingsUpdate(BaseModel):
    high_priority_days: Optional[int] = Field(None, ge=1, le=365)
    high_priority_recurring: Optional[str] = None
    normal_priority_days: Optional[int] = Field(None, ge=1, le=365)
    normal_priority_recurring: Optional[str] = None
    low_priority_days: Optional[int] = Field(None, ge=1, le=365)
    low_priority_recurring: Optional[str] = None
    trigger_time: Optional[str] = Field(None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone: Optional[str] = Field(None, min_length=1, max_length=100)
    enabled: Optional[bool] = None

    @field_validator(
        "high_priority_recurring",
        "normal_priority_recurring",
        "low_priority_recurring",
    )
    @classmethod
    def validate_recurring_interval(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value in {"daily", "weekly"}:
            return value
        match = re.fullmatch(r"every_(\d+)_days", value)
        if match is None or not 1 <= int(match.group(1)) <= 365:
            raise ValueError("Recurrence must be daily, weekly, or every 1 to 365 days")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as error:
            raise ValueError("Timezone must be a valid IANA timezone") from error
        return value


class OrderDocumentNumberingUpdate(BaseModel):
    prefix: str = Field(..., min_length=1, max_length=20, pattern=r"^[A-Za-z0-9-]+$")
    next_number: int = Field(..., ge=1)


class OrderDocumentNumberingOut(BaseModel):
    prefix: str
    next_number: int

    model_config = ConfigDict(from_attributes=True)


class CompanyStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(active|suspended|pending_activation)$")
    reason: Optional[str] = None

class CompanyOut(CompanyBase):
    id: str
    status: str
    owner_id: Optional[str] = None
    owner: Optional[UserOut] = None
    subscription: Optional[CompanySubscriptionOut] = None
    member_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CompanyWithOwnerProvisionedOut(BaseModel):
    company: CompanyOut
    invitation_token: Optional[str] = None
    activation_url: Optional[str] = None
    message: str
