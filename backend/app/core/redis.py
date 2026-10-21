import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings

redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> Optional[aioredis.Redis]:
    """Return the initialized Redis client or None if Redis is unavailable."""
    return redis_client

def tenant_cache_key(company_id: str, key: str) -> str:
    """Ensure strict tenant isolation in cache keys"""
    return f"tenant:{company_id}:{key}"
