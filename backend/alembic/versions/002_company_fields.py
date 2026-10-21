"""Add company fields: GST, address, website

Revision ID: 002_company_fields
Revises: 001_initial
Create Date: 2026-10-20 23:02:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_company_fields'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add new fields to companies table
    op.add_column('companies', sa.Column('gst_number', sa.String(length=15), nullable=True))
    op.add_column('companies', sa.Column('address', sa.String(length=500), nullable=True))
    op.add_column('companies', sa.Column('website', sa.String(length=255), nullable=True))

def downgrade() -> None:
    # Remove the added fields
    op.drop_column('companies', 'website')
    op.drop_column('companies', 'address')
    op.drop_column('companies', 'gst_number')
