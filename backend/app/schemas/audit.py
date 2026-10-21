from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str]
    company_id: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    details: Dict[str, Any]
    created_at: datetime
    user_email: Optional[str] = None
    company_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
