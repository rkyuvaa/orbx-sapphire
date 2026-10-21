"""Add tenant notification foundation

Revision ID: 003_notifications
Revises: 002_company_fields
Create Date: 2026-10-20 23:33:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_notifications"
down_revision: Union[str, None] = "002_company_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "notification_subscriptions" not in existing_tables:
        op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("p256dh_key", sa.Text(), nullable=False),
        sa.Column("auth_key", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.String(length=512)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    existing_indexes = {
        table: {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}
        for table in ("notification_subscriptions", "notifications", "notification_preferences")
        if table in existing_tables
    }
    for name, columns in (
        ("ix_notification_subscriptions_user_id", ["user_id"]),
        ("ix_notification_subscriptions_company_id", ["company_id"]),
    ):
        if name not in existing_indexes.get("notification_subscriptions", set()):
            op.create_index(name, "notification_subscriptions", columns)

    if "notifications" not in existing_tables:
        op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("company_id", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link", sa.String(length=2048)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    for column in ("company_id", "recipient_id", "type"):
        name = f"ix_notifications_{column}"
        if name not in existing_indexes.get("notifications", set()):
            op.create_index(name, "notifications", [column])
    if "notification_preferences" not in existing_tables:
        op.create_table(
        "notification_preferences",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("web_push_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("type_preferences", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "company_id", name="uq_notification_preference_user_company"),
        )
    for name, columns in (
        ("ix_notification_preferences_user_id", ["user_id"]),
        ("ix_notification_preferences_company_id", ["company_id"]),
    ):
        if name not in existing_indexes.get("notification_preferences", set()):
            op.create_index(name, "notification_preferences", columns)


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("notification_subscriptions")
