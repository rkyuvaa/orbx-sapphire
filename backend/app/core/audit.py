from typing import Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from app.models.audit import AuditLog

async def log_audit_event(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    ip_address = None
    user_agent = None

    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    log_entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        company_id=company_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent[:255] if user_agent else None
    )
    db.add(log_entry)
    await db.commit()
    return log_entry
