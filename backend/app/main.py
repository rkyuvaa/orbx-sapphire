from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.core import redis as redis_store
from app.core.redis import get_redis
from app.models.user import User
from app.models.subscription import SubscriptionPlan
from app.api.v1.router import api_v1_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orbx")


async def init_db_and_seed():
    """Initializes tables and seeds the initial platform Super Admin and default plans."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed Super Admin
        stmt = select(User).where(User.email == settings.FIRST_SUPERADMIN_EMAIL.lower())
        res = await session.execute(stmt)
        superadmin = res.scalar_one_or_none()
        if not superadmin:
            superadmin = User(
                email=settings.FIRST_SUPERADMIN_EMAIL.lower(),
                full_name=settings.FIRST_SUPERADMIN_NAME,
                hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD),
                is_superadmin=True,
                is_active=True
            )
            session.add(superadmin)
            logger.info(f"Seeded Platform Super Admin: {settings.FIRST_SUPERADMIN_EMAIL}")

        # 2. Seed Default Subscription Plans
        plan_check = await session.execute(select(SubscriptionPlan))
        if not plan_check.scalar_one_or_none():
            from app.models.subscription import SubscriptionPlan as PlanModel
            plans = [
                SubscriptionPlan(
                    code="starter",
                    name="Starter",
                    description="Basic plan for small teams",
                    max_users=10,
                    modules_allowed={"orders": True, "team": True},
                    is_active=True
                ),
                SubscriptionPlan(
                    code="professional",
                    name="Professional",
                    description="Professional plan for growing teams",
                    max_users=50,
                    modules_allowed={"orders": True, "team": True, "inventory": True},
                    is_active=True
                ),
                SubscriptionPlan(
                    code="enterprise",
                    name="Enterprise Haute",
                    description="Unlimited users, multi-location, and priority support",
                    max_users=100,
                    modules_allowed={"orders": True, "team": True, "inventory": True, "expenses": True, "reports": True},
                    is_active=True
                )
            ]
            session.add_all(plans)
            logger.info("Seeded default Subscription Plans (Starter, Professional, Enterprise)")

        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create Redis client on startup and close it on shutdown."""
    # Check for default SECRET_KEY (local dev only - should be overridden by .env)
    if settings.SECRET_KEY == "orbx-super-secret-key-change-in-production-min32chars":
        logger.warning(
            "SECRET_KEY is using the default value! "
            "Set a custom SECRET_KEY in your .env file for production."
        )

    # Check for default FIRST_SUPERADMIN_PASSWORD (local dev only - should be overridden by .env)
    if settings.FIRST_SUPERADMIN_PASSWORD == "OrbXAdmin@2026!":
        logger.warning(
            "FIRST_SUPERADMIN_PASSWORD is using the default value! "
            "Set a custom FIRST_SUPERADMIN_PASSWORD in your .env file for production."
        )

    # Create Redis client at startup
    logger.info("Initializing Redis client...")
    try:
        _redis = await aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=2.0
        )
        redis_store.redis_client = _redis
        logger.info("Redis client initialized successfully")
    except Exception as e:
        logger.warning(f"Redis initialization failed: {e}")
        redis_store.redis_client = None

    yield

    # Close Redis client on shutdown
    logger.info("Closing Redis client...")
    _redis = await get_redis()
    if _redis:
        await _redis.aclose()
        redis_store.redis_client = None
        logger.info("Redis client closed successfully")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="OrbX Multi-Tenant SaaS Platform API",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    db_status = "connected"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(1))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    redis_status = "disabled/not connected"
    try:
        r = await get_redis()
        if r:
            await r.ping()
            redis_status = "connected"
    except Exception:
        redis_status = "offline"

    return {
        "status": "online",
        "service": "OrbX API",
        "database": db_status,
        "redis": redis_status,
        "version": "1.0.0"
    }

app.include_router(api_v1_router, prefix=settings.API_V1_STR)
