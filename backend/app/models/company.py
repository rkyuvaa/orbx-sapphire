from sqlalchemy import String, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.membership import CompanyMembership
    from app.models.subscription import CompanySubscription
    from app.models.invitation import Invitation
    from app.models.audit import AuditLog

class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", index=True, nullable=False) # active, suspended, pending_activation
    owner_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    
    @property
    def reminder_settings(self) -> dict:
        """Get reminder settings from company settings, with defaults."""
        defaults = {
            'high_priority_days': 15,
            'high_priority_recurring': 'daily',
            'normal_priority_days': 10,
            'normal_priority_recurring': 'every_2_days',
            'low_priority_days': 5,
            'low_priority_recurring': 'every_1_day',
            'trigger_time': '09:00',
            'timezone': (self.settings or {}).get('timezone', ''),
            'enabled': True,
        }
        return {**defaults, **(self.settings or {}).get('reminder', {})}
    
    @reminder_settings.setter
    def reminder_settings(self, value: dict) -> None:
        """Set reminder settings in company settings."""
        settings = self.settings or {}
        settings['reminder'] = value
        self.settings = settings

    owner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[owner_id], lazy="selectin")
    members: Mapped[List["CompanyMembership"]] = relationship(
        "CompanyMembership",
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    subscription: Mapped[Optional["CompanySubscription"]] = relationship(
        "CompanySubscription",
        back_populates="company",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    invitations: Mapped[List["Invitation"]] = relationship(
        "Invitation",
        back_populates="company",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="company",
        lazy="selectin"
    )
