from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class SubscriptionPlanBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    max_users: int = 5
    modules_allowed: Dict[str, Any] = {}
    is_active: bool = True

class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass

class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_users: Optional[int] = None
    modules_allowed: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class SubscriptionPlanOut(SubscriptionPlanBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CompanySubscriptionOut(BaseModel):
    id: str
    company_id: str
    plan_id: str
    status: str
    started_at: datetime
    expires_at: Optional[datetime] = None
    plan: Optional[SubscriptionPlanOut] = None

    model_config = ConfigDict(from_attributes=True)
