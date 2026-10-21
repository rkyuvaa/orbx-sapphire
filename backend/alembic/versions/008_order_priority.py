"""Add persisted priority to customer orders.

Revision ID: 008_order_priority
Revises: 007_customer_measurements
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008_order_priority"
down_revision: Union[str, None] = "007_customer_measurements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
    )


def downgrade() -> None:
    op.drop_column("orders", "priority")
