from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, computed_field

class Settings(BaseSettings):
    PROJECT_NAME: str = "OrbX"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "orbx-super-secret-key-change-in-production-min32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    INVITATION_TOKEN_EXPIRE_HOURS: int = 48
    PASSWORD_RESET_EXPIRE_HOURS: int = 24

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/orbx"
    # Fallback/Test SQLite async database
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///./test_orbx.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Web Push (VAPID). Leave unset to disable delivery workers until configured.
    WEB_PUSH_VAPID_PRIVATE_KEY: Optional[str] = None
    WEB_PUSH_VAPID_SUBJECT: str = "mailto:admin@orbx.in"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sapphire.orbx.in",
        "https://app.orbx.in"
    ]

    # Super Admin Seed
    FIRST_SUPERADMIN_EMAIL: str = "admin@orbx.in"
    FIRST_SUPERADMIN_PASSWORD: str = "OrbXAdmin@2026!"
    FIRST_SUPERADMIN_NAME: str = "Platform Super Admin"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

settings = Settings()
