"""Add idempotency records for scheduled customer order reminders.

Revision ID: 009_order_reminders
Revises: 008_order_priority
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_order_reminders"
down_revision: Union[str, None] = "008_order_priority"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "order_reminder_dispatches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "company_id",
            sa.String(length=36),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "order_id",
            sa.String(length=36),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "order_id",
            "recipient_id",
            "scheduled_date",
            name="uq_order_reminder_recipient_date",
        ),
    )
    op.create_index(
        "ix_order_reminder_dispatches_company_id",
        "order_reminder_dispatches",
        ["company_id"],
    )
    op.create_index(
        "ix_order_reminder_dispatches_order_id",
        "order_reminder_dispatches",
        ["order_id"],
    )
    op.create_index(
        "ix_order_reminder_dispatches_recipient_id",
        "order_reminder_dispatches",
        ["recipient_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_order_reminder_dispatches_recipient_id", table_name="order_reminder_dispatches")
    op.drop_index("ix_order_reminder_dispatches_order_id", table_name="order_reminder_dispatches")
    op.drop_index("ix_order_reminder_dispatches_company_id", table_name="order_reminder_dispatches")
    op.drop_table("order_reminder_dispatches")
