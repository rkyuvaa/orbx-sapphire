"""Store current measurements on customers and make order dates editable.

Revision ID: 007_customer_measurements
Revises: 006_customer_document_numbering
"""
from datetime import datetime, timezone
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "007_customer_measurements"
down_revision: Union[str, None] = "006_customer_document_numbering"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    if "order_date" not in order_columns:
        op.add_column("orders", sa.Column("order_date", sa.DateTime(timezone=True), nullable=True))
        op.execute(sa.text("UPDATE orders SET order_date = created_at WHERE order_date IS NULL"))
        with op.batch_alter_table("orders") as batch_op:
            batch_op.alter_column("order_date", existing_type=sa.DateTime(timezone=True), nullable=False)

    if "customer_measurements" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "customer_measurements",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("customer_id", sa.String(length=36), nullable=False),
            sa.Column("field_id", sa.String(length=36), nullable=True),
            sa.Column("tab_id", sa.String(length=36), nullable=True),
            sa.Column("tab_name", sa.String(length=100), nullable=False),
            sa.Column("field_name", sa.String(length=100), nullable=False),
            sa.Column("field_type", sa.String(length=50), nullable=False),
            sa.Column("unit", sa.String(length=10), nullable=False),
            sa.Column("value", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["field_id"], ["measurement_fields.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["tab_id"], ["measurement_tabs.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("customer_id", "field_id", name="uq_customer_measurement_field"),
        )
        op.create_index("ix_customer_measurements_customer_id", "customer_measurements", ["customer_id"])
        op.create_index("ix_customer_measurements_field_id", "customer_measurements", ["field_id"])
        op.create_index("ix_customer_measurements_tab_id", "customer_measurements", ["tab_id"])

    now = datetime.now(timezone.utc)
    rows = bind.execute(
        sa.text(
            "SELECT orders.customer_id, order_measurements.field_id, "
            "order_measurements.tab_id, order_measurements.tab_name, "
            "order_measurements.field_name, order_measurements.field_type, "
            "order_measurements.unit, order_measurements.value "
            "FROM order_measurements "
            "JOIN orders ON orders.id = order_measurements.order_id "
            "WHERE order_measurements.field_id IS NOT NULL "
            "ORDER BY orders.created_at DESC, orders.id DESC"
        )
    ).mappings().all()

    latest_values = {}
    for row in rows:
        key = (row["customer_id"], row["field_id"])
        latest_values.setdefault(key, row)

    for row in latest_values.values():
        bind.execute(
            sa.text(
                "INSERT INTO customer_measurements "
                "(id, customer_id, field_id, tab_id, tab_name, field_name, "
                "field_type, unit, value, created_at, updated_at) "
                "VALUES (:id, :customer_id, :field_id, :tab_id, :tab_name, "
                ":field_name, :field_type, :unit, :value, :created_at, :updated_at)"
            ),
            {
                "id": str(uuid4()),
                "customer_id": row["customer_id"],
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

    if "order_document_numbering" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "order_document_numbering",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("company_id", sa.String(length=36), nullable=False),
            sa.Column("prefix", sa.String(length=20), nullable=False, server_default="ORD-"),
            sa.Column("next_number", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("company_id", name="uq_order_document_numbering_company"),
        )
        op.create_index(
            "ix_order_document_numbering_company_id",
            "order_document_numbering",
            ["company_id"],
        )

    company_ids = bind.execute(sa.text("SELECT id FROM companies")).scalars().all()
    for company_id in company_ids:
        bind.execute(
            sa.text(
                "INSERT INTO order_document_numbering "
                "(id, company_id, prefix, next_number, created_at, updated_at) "
                "VALUES (:id, :company_id, :prefix, :next_number, :created_at, :updated_at)"
            ),
            {
                "id": str(uuid4()),
                "company_id": company_id,
                "prefix": "ORD-",
                "next_number": 1,
                "created_at": now,
                "updated_at": now,
            },
        )

    customer_columns = {column["name"] for column in sa.inspect(bind).get_columns("customers")}
    if "document_number" in customer_columns:
        with op.batch_alter_table("customers") as batch_op:
            batch_op.drop_constraint("uq_customer_document_number_per_company", type_="unique")
            batch_op.drop_column("document_number")

    tables = set(sa.inspect(bind).get_table_names())
    if "customer_document_numbering" in tables:
        op.drop_index(
            "ix_customer_document_numbering_company_id",
            table_name="customer_document_numbering",
        )
        op.drop_table("customer_document_numbering")

    if "order_measurements" in sa.inspect(bind).get_table_names():
        op.drop_table("order_measurements")


def downgrade() -> None:
    op.create_table(
        "customer_document_numbering",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("prefix", sa.String(length=20), nullable=False, server_default="CUS-"),
        sa.Column("next_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", name="uq_customer_document_numbering_company"),
    )
    op.create_index(
        "ix_customer_document_numbering_company_id",
        "customer_document_numbering",
        ["company_id"],
    )
    op.add_column("customers", sa.Column("document_number", sa.String(length=40), nullable=True))
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    for company_id in bind.execute(sa.text("SELECT id FROM companies")).scalars().all():
        customer_ids = bind.execute(
            sa.text("SELECT id FROM customers WHERE company_id = :company_id ORDER BY created_at, id"),
            {"company_id": company_id},
        ).scalars().all()
        for number, customer_id in enumerate(customer_ids, start=1):
            bind.execute(
                sa.text("UPDATE customers SET document_number = :value WHERE id = :id"),
                {"value": f"CUS-{number:06d}", "id": customer_id},
            )
        bind.execute(
            sa.text(
                "INSERT INTO customer_document_numbering "
                "(id, company_id, prefix, next_number, created_at, updated_at) "
                "VALUES (:id, :company_id, :prefix, :next_number, :created_at, :updated_at)"
            ),
            {
                "id": str(uuid4()),
                "company_id": company_id,
                "prefix": "CUS-",
                "next_number": len(customer_ids) + 1,
                "created_at": now,
                "updated_at": now,
            },
        )
    with op.batch_alter_table("customers") as batch_op:
        batch_op.alter_column("document_number", existing_type=sa.String(length=40), nullable=False)
        batch_op.create_unique_constraint(
            "uq_customer_document_number_per_company",
            ["company_id", "document_number"],
        )
    op.drop_index(
        "ix_order_document_numbering_company_id",
        table_name="order_document_numbering",
    )
    op.drop_table("order_document_numbering")
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
    )
    op.create_index("ix_order_measurements_order_id", "order_measurements", ["order_id"])
    op.drop_index("ix_customer_measurements_tab_id", table_name="customer_measurements")
    op.drop_index("ix_customer_measurements_field_id", table_name="customer_measurements")
    op.drop_index("ix_customer_measurements_customer_id", table_name="customer_measurements")
    op.drop_table("customer_measurements")
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("order_date")
