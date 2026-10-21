"""Preserve measurement tab names on orders

Revision ID: 005_measurement_tab_snapshot
Revises: 004_orders
Create Date: 2026-10-21 00:23:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_measurement_tab_snapshot"
down_revision: Union[str, None] = "004_orders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("order_measurements")
    }
    if "tab_name" not in columns:
        op.add_column(
            "order_measurements",
            sa.Column("tab_name", sa.String(length=100), nullable=False, server_default=""),
        )

    op.execute(
        sa.text(
            "UPDATE order_measurements "
            "SET tab_name = (SELECT measurement_tabs.name "
            "FROM measurement_tabs "
            "WHERE measurement_tabs.id = order_measurements.tab_id) "
            "WHERE order_measurements.tab_id IS NOT NULL "
            "AND order_measurements.tab_name = ''"
        )
    )


def downgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("order_measurements")
    }
    if "tab_name" in columns:
        op.drop_column("order_measurements", "tab_name")
