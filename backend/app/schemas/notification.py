from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class WebPushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=4096)
    auth: str = Field(min_length=1, max_length=4096)


class WebPushSubscriptionCreate(BaseModel):
    endpoint: str = Field(min_length=1, max_length=4096)
    keys: WebPushKeys


class WebPushSubscriptionDelete(BaseModel):
    endpoint: str = Field(min_length=1, max_length=4096)


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    link: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: Optional[bool] = None
    web_push_enabled: Optional[bool] = None
    type_preferences: Optional[dict[str, bool]] = None


class NotificationPreferenceOut(BaseModel):
    in_app_enabled: bool
    web_push_enabled: bool
    type_preferences: dict

    model_config = ConfigDict(from_attributes=True)
