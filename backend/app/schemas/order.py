from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re


class OrderStatus(str, Enum):
    ORDER_RECEIVED = "order_received"
    MATERIAL_MARKING = "material_marking"
    DESIGN_WORK = "design_work"
    CUTTING = "cutting"
    STITCHING = "stitching"
    FINISHING = "finishing"
    TRIAL = "trial"
    READY_FOR_DELIVERY = "ready_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


ORDER_STATUS_LABELS = {
    OrderStatus.ORDER_RECEIVED: "Order Received",
    OrderStatus.MATERIAL_MARKING: "Material Marking",
    OrderStatus.DESIGN_WORK: "Design Work",
    OrderStatus.CUTTING: "Cutting",
    OrderStatus.STITCHING: "Stitching",
    OrderStatus.FINISHING: "Finishing",
    OrderStatus.TRIAL: "Trial",
    OrderStatus.READY_FOR_DELIVERY: "Ready for Delivery",
    OrderStatus.DELIVERED: "Delivered",
    OrderStatus.CANCELLED: "Cancelled",
}

ORDER_STATUS_SEQUENCE = [
    OrderStatus.ORDER_RECEIVED,
    OrderStatus.MATERIAL_MARKING,
    OrderStatus.DESIGN_WORK,
    OrderStatus.CUTTING,
    OrderStatus.STITCHING,
    OrderStatus.FINISHING,
    OrderStatus.TRIAL,
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.DELIVERED,
]


# Customer schemas
class CustomerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    phone_number: str = Field(..., max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Please check the Mobile number")
        normalized = re.sub(r"[\s().-]", "", value.strip())
        digits = re.sub(r"\D", "", normalized)
        if len(digits) < 10 or not re.fullmatch(r"\+?\d{10,20}", normalized):
            raise ValueError("Please check the Mobile number")
        return normalized


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Please check the Mobile number")
        normalized = re.sub(r"[\s().-]", "", value.strip())
        digits = re.sub(r"\D", "", normalized)
        if len(digits) < 10 or not re.fullmatch(r"\+?\d{10,20}", normalized):
            raise ValueError("Please check the Mobile number")
        return normalized


class CustomerOut(CustomerBase):
    id: str
    company_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Measurement config schemas
class MeasurementFieldBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    field_type: str = Field(..., pattern=r"^(text|number|textarea)$")
    unit: str = Field(..., pattern=r"^(mm|cm|in|mtr)$")
    required: bool = False


class MeasurementFieldCreate(MeasurementFieldBase):
    pass


class MeasurementFieldUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    field_type: Optional[str] = Field(None, pattern=r"^(text|number|textarea)$")
    unit: Optional[str] = Field(None, pattern=r"^(mm|cm|in|mtr)$")
    required: Optional[bool] = None
    enabled: Optional[bool] = None


class MeasurementFieldOut(MeasurementFieldBase):
    id: str
    tab_id: str
    enabled: bool
    order: int

    model_config = ConfigDict(from_attributes=True)


class MeasurementTabBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    enabled: bool = True


class MeasurementTabCreate(MeasurementTabBase):
    fields: List[MeasurementFieldCreate] = Field(default_factory=list)


class MeasurementTabUpdate(MeasurementTabBase):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    enabled: Optional[bool] = None
    order: Optional[int] = Field(None, ge=0)


class MeasurementTabOrderUpdate(BaseModel):
    tab_ids: List[str] = Field(..., min_length=1)


class MeasurementFieldOrderUpdate(BaseModel):
    field_ids: List[str] = Field(..., min_length=1)


class MeasurementTabOut(MeasurementTabBase):
    id: str
    company_id: str
    order: int
    fields: List[MeasurementFieldOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Order measurement schemas
class OrderMeasurementBase(BaseModel):
    tab_id: str
    field_id: str
    tab_name: Optional[str] = None
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    unit: Optional[str] = None
    value: Optional[str] = None


class OrderMeasurementCreate(OrderMeasurementBase):
    pass


class CustomerMeasurementInput(BaseModel):
    field_id: str
    value: Optional[str] = None


class MeasurementRecordOut(BaseModel):
    id: str
    field_id: Optional[str] = None
    tab_id: Optional[str] = None
    tab_name: str
    field_name: str
    field_type: str
    unit: str
    value: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerMeasurementOut(MeasurementRecordOut):
    customer_id: Optional[str] = None


class OrderMeasurementOut(MeasurementRecordOut):
    order_id: Optional[str] = None
    customer_id: Optional[str] = None


# Order schemas
class OrderBase(BaseModel):
    order_number: Optional[str] = Field(None, min_length=1, max_length=50)
    order_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    priority: str = Field("normal", pattern=r"^(high|normal|low)$")


class OrderCreate(OrderBase):
    customer_id: Optional[str] = None
    customer: Optional[CustomerCreate] = None
    measurements: List[OrderMeasurementCreate] = Field(default_factory=list)

    @field_validator("order_number")
    @classmethod
    def normalize_order_number(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Order number cannot be blank")
        return normalized


class OrderUpdate(BaseModel):
    order_number: Optional[str] = Field(None, min_length=1, max_length=50)
    order_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = Field(None, pattern=r"^(high|normal|low)$")
    measurements: Optional[List[OrderMeasurementCreate]] = None

    @field_validator("order_number")
    @classmethod
    def normalize_order_number(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Order number cannot be blank")
        return normalized


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    reason: Optional[str] = Field(None, max_length=500)


class OrderStatusHistoryOut(BaseModel):
    id: str
    order_id: str
    old_status: str
    new_status: str
    reason: Optional[str]
    changed_at: datetime
    changed_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: str
    company_id: str
    customer_id: str
    created_by_id: Optional[str]
    order_number: str
    order_date: datetime
    status: str
    due_date: Optional[datetime]
    priority: str = "normal"
    created_at: datetime
    updated_at: datetime
    
    customer: CustomerOut
    created_by_name: Optional[str] = None
    status_history: List[OrderStatusHistoryOut] = Field(default_factory=list)
    measurements: List[OrderMeasurementOut] = Field(default_factory=list)
    
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class OrderListOut(BaseModel):
    id: str
    company_id: str
    order_number: str
    order_date: datetime
    status: str
    due_date: Optional[datetime]
    priority: str = "normal"
    created_at: datetime
    
    customer_name: str
    customer_phone: str
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class OrderFilter(BaseModel):
    status: Optional[List[str]] = None
    customer_id: Optional[str] = None
    due_date_from: Optional[datetime] = None
    due_date_to: Optional[datetime] = None
    search: Optional[str] = None
