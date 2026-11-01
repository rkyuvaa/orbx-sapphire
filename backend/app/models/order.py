from sqlalchemy import String, ForeignKey, DateTime, Text, Integer, Boolean, UniqueConstraint, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid, utc_now

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("company_id", "phone_number", name="uq_customer_phone_per_company"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    company: Mapped["Company"] = relationship("Company", lazy="selectin")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
    measurements: Mapped[List["CustomerMeasurement"]] = relationship(
        "CustomerMeasurement",
        back_populates="customer",
        cascade="all, delete-orphan",
    )


class Order(Base, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("company_id", "order_number", name="uq_order_company_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False)
    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    order_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="order_received", index=True, nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    
    company: Mapped["Company"] = relationship("Company", lazy="selectin")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="orders", lazy="selectin")
    created_by: Mapped[Optional["User"]] = relationship("User", lazy="selectin")
    status_history: Mapped[List["OrderStatusHistory"]] = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.created_at",
    )
    measurements: Mapped[List["OrderMeasurement"]] = relationship(
        "OrderMeasurement",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OrderDocumentNumbering(Base, TimestampMixin):
    __tablename__ = "order_document_numbering"
    __table_args__ = (UniqueConstraint("company_id", name="uq_order_document_numbering_company"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="ORD-")
    next_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class OrderReminderDispatch(Base, TimestampMixin):
    __tablename__ = "order_reminder_dispatches"
    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "recipient_id",
            "scheduled_date",
            name="uq_order_reminder_recipient_date",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    recipient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)


class OrderStatusHistory(Base, TimestampMixin):
    __tablename__ = "order_status_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    changed_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    old_status: Mapped[str] = mapped_column(String(50), nullable=False)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="status_history", lazy="selectin")
    changed_by: Mapped[Optional["User"]] = relationship("User", lazy="selectin")


class MeasurementTab(Base, TimestampMixin):
    __tablename__ = "measurement_tabs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    company: Mapped["Company"] = relationship("Company", lazy="selectin")
    fields: Mapped[List["MeasurementField"]] = relationship(
        "MeasurementField",
        back_populates="tab",
        cascade="all, delete-orphan",
        order_by="MeasurementField.order",
        lazy="selectin",
    )


class MeasurementField(Base, TimestampMixin):
    __tablename__ = "measurement_fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    tab_id: Mapped[str] = mapped_column(String(36), ForeignKey("measurement_tabs.id", ondelete="CASCADE"), index=True, nullable=False)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)  # text, number, textarea
    unit: Mapped[str] = mapped_column(String(10), nullable=False)  # mm, cm, in, mtr
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    tab: Mapped["MeasurementTab"] = relationship("MeasurementTab", back_populates="fields", lazy="selectin")


class CustomerMeasurement(Base, TimestampMixin):
    __tablename__ = "customer_measurements"
    __table_args__ = (
        UniqueConstraint("customer_id", "field_id", name="uq_customer_measurement_field"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    customer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False
    )
    field_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("measurement_fields.id", ondelete="SET NULL"), index=True, nullable=True
    )
    tab_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("measurement_tabs.id", ondelete="SET NULL"), index=True, nullable=True
    )
    tab_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="measurements")


class OrderMeasurement(Base, TimestampMixin):
    __tablename__ = "order_measurements"
    __table_args__ = (
        UniqueConstraint("order_id", "field_id", name="uq_order_measurement_field"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    field_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("measurement_fields.id", ondelete="SET NULL"), index=True, nullable=True
    )
    tab_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("measurement_tabs.id", ondelete="SET NULL"), index=True, nullable=True
    )
    tab_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="measurements")
