"""Add per-company customer document numbering.

Revision ID: 006_customer_document_numbering
Revises: 005_measurement_tab_snapshot
"""
from datetime import datetime, timezone
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "006_customer_document_numbering"
down_revision: Union[str, None] = "005_measurement_tab_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "customer_document_numbering" not in tables:
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

    if "document_number" not in {
        column["name"] for column in inspector.get_columns("customers")
    }:
        op.add_column(
            "customers",
            sa.Column("document_number", sa.String(length=40), nullable=True),
        )

    now = datetime.now(timezone.utc)
    company_ids = bind.execute(sa.text("SELECT id FROM companies")).scalars().all()
    for company_id in company_ids:
        customer_rows = bind.execute(
            sa.text(
                "SELECT id FROM customers WHERE company_id = :company_id "
                "ORDER BY created_at, id"
            ),
            {"company_id": company_id},
        ).scalars().all()
        for number, customer_id in enumerate(customer_rows, start=1):
            bind.execute(
                sa.text(
                    "UPDATE customers SET document_number = :document_number "
                    "WHERE id = :customer_id"
                ),
                {
                    "document_number": f"CUS-{number:06d}",
                    "customer_id": customer_id,
                },
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
                "next_number": len(customer_rows) + 1,
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


def downgrade() -> None:
    with op.batch_alter_table("customers") as batch_op:
        batch_op.drop_constraint("uq_customer_document_number_per_company", type_="unique")
        batch_op.drop_column("document_number")
    op.drop_index(
        "ix_customer_document_numbering_company_id",
        table_name="customer_document_numbering",
    )
    op.drop_table("customer_document_numbering")
