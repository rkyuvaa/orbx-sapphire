from pydantic import BaseModel
from typing import List, Dict, Any
from app.schemas.audit import AuditLogOut

class PlatformDashboardStats(BaseModel):
    total_companies: int
    active_companies: int
    suspended_companies: int
    pending_companies: int
    total_users: int
    plan_distribution: Dict[str, int]
    recent_activities: List[AuditLogOut] = []
