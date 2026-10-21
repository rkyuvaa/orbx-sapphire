import bcrypt
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from jose import jwt
import secrets
from app.core.config import settings

_PASSWORD_HASH_PREFIX = "$orbx-sha256$"


def _password_hash_input(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(_password_hash_input(password), salt).decode("ascii")
    return f"{_PASSWORD_HASH_PREFIX}{hashed}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if hashed_password.startswith(_PASSWORD_HASH_PREFIX):
            return bcrypt.checkpw(
                _password_hash_input(plain_password),
                hashed_password[len(_PASSWORD_HASH_PREFIX):].encode("ascii"),
            )

        # Existing bcrypt hashes were generated from the raw password.
        # Older bcrypt releases truncated inputs at 72 bytes, so preserve that
        # behavior when verifying legacy hashes.
        password_bytes = plain_password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        return bcrypt.checkpw(
            password_bytes,
            hashed_password.encode("utf-8")
        )
    except (TypeError, ValueError):
        return False

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def generate_secure_token() -> str:
    return secrets.token_urlsafe(32)
