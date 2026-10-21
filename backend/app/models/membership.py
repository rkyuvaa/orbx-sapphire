from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.company import Company

class CompanyMembership(Base, TimestampMixin):
    __tablename__ = "company_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company_membership"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="staff", nullable=False)  # owner, manager, staff
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active, inactive

    user: Mapped["User"] = relationship("User", back_populates="memberships", lazy="selectin")
    company: Mapped["Company"] = relationship("Company", back_populates="members", lazy="selectin")
