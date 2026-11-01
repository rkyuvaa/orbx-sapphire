"""Add order_measurements snapshot table and backfill from customer measurements.

Revision ID: 010_order_measurements
Revises: 009_order_reminders
"""
from datetime import datetime, timezone
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "010_order_measurements"
down_revision: Union[str, None] = "009_order_reminders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "order_measurements" not in tables:
        op.create_table(
            "order_measurements",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("order_id", sa.String(length=36), nullable=False),
            sa.Column("field_id", sa.String(length=36), nullable=True),
            sa.Column("tab_id", sa.String(length=36), nullable=True),
            sa.Column("tab_name", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("field_name", sa.String(length=100), nullable=False),
            sa.Column("field_type", sa.String(length=50), nullable=False),
            sa.Column("unit", sa.String(length=10), nullable=False),
            sa.Column("value", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["field_id"], ["measurement_fields.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["tab_id"], ["measurement_tabs.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id", "field_id", name="uq_order_measurement_field"),
        )
        op.create_index("ix_order_measurements_order_id", "order_measurements", ["order_id"])
        op.create_index("ix_order_measurements_field_id", "order_measurements", ["field_id"])
        op.create_index("ix_order_measurements_tab_id", "order_measurements", ["tab_id"])

    # Backfill: for every existing order, copy the customer's measurements as the initial snapshot
    if "customer_measurements" in tables and "orders" in tables:
        now = datetime.now(timezone.utc)
        rows = bind.execute(
            sa.text(
                "SELECT orders.id AS order_id, cm.field_id, cm.tab_id, "
                "cm.tab_name, cm.field_name, cm.field_type, cm.unit, cm.value "
                "FROM orders "
                "JOIN customer_measurements cm ON cm.customer_id = orders.customer_id "
                "WHERE cm.field_id IS NOT NULL"
            )
        ).mappings().all()

        existing_pairs = set(
            bind.execute(
                sa.text("SELECT order_id, field_id FROM order_measurements")
            ).fetchall()
        )

        for row in rows:
            pair = (row["order_id"], row["field_id"])
            if pair in existing_pairs:
                continue
            existing_pairs.add(pair)
            bind.execute(
                sa.text(
                    "INSERT INTO order_measurements "
                    "(id, order_id, field_id, tab_id, tab_name, field_name, "
                    "field_type, unit, value, created_at, updated_at) "
                    "VALUES (:id, :order_id, :field_id, :tab_id, :tab_name, "
                    ":field_name, :field_type, :unit, :value, :created_at, :updated_at)"
                ),
                {
                    "id": str(uuid4()),
                    "order_id": row["order_id"],
                    "field_id": row["field_id"],
                    "tab_id": row["tab_id"],
                    "tab_name": row["tab_name"],
                    "field_name": row["field_name"],
                    "field_type": row["field_type"],
                    "unit": row["unit"],
                    "value": row["value"],
                    "created_at": now,
                    "updated_at": now,
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "order_measurements" in tables:
        op.drop_table("order_measurements")
