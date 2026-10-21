"""Add Customer Order module models

Revision ID: 004_orders
Revises: 003_notifications
Create Date: 2026-10-21 00:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_orders'
down_revision: Union[str, None] = '003_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    # Create customers table
    if 'customers' not in existing_tables:
        op.create_table(
        'customers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone_number', sa.String(length=20), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'phone_number', name='uq_customer_phone_per_company')
        )
    existing_indexes = {
        table: {index['name'] for index in sa.inspect(op.get_bind()).get_indexes(table)}
        for table in (
            'customers', 'orders', 'order_status_history', 'measurement_tabs',
            'measurement_fields', 'order_measurements'
        )
        if table in existing_tables
    }
    for name, columns in (
        (op.f('ix_customers_company_id'), ['company_id']),
        (op.f('ix_customers_name'), ['name']),
        (op.f('ix_customers_phone_number'), ['phone_number']),
    ):
        if name not in existing_indexes.get('customers', set()):
            op.create_index(name, 'customers', columns)

    # Create orders table
    if 'orders' not in existing_tables:
        op.create_table(
        'orders',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('created_by_id', sa.String(length=36), nullable=True),
        sa.Column('order_number', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='order_received'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'order_number', name='uq_order_company_number')
        )
    for name, columns in (
        (op.f('ix_orders_company_id'), ['company_id']),
        (op.f('ix_orders_customer_id'), ['customer_id']),
        (op.f('ix_orders_status'), ['status']),
        (op.f('ix_orders_due_date'), ['due_date']),
    ):
        if name not in existing_indexes.get('orders', set()):
            op.create_index(name, 'orders', columns)

    # Create order_status_history table
    if 'order_status_history' not in existing_tables:
        op.create_table(
        'order_status_history',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('order_id', sa.String(length=36), nullable=False),
        sa.Column('changed_by_id', sa.String(length=36), nullable=True),
        sa.Column('old_status', sa.String(length=50), nullable=False),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
        )
    if op.f('ix_order_status_history_order_id') not in existing_indexes.get('order_status_history', set()):
        op.create_index(op.f('ix_order_status_history_order_id'), 'order_status_history', ['order_id'])

    # Create measurement_tabs table
    if 'measurement_tabs' not in existing_tables:
        op.create_table(
        'measurement_tabs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
    if op.f('ix_measurement_tabs_company_id') not in existing_indexes.get('measurement_tabs', set()):
        op.create_index(op.f('ix_measurement_tabs_company_id'), 'measurement_tabs', ['company_id'])

    # Create measurement_fields table
    if 'measurement_fields' not in existing_tables:
        op.create_table(
        'measurement_fields',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tab_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('field_type', sa.String(length=50), nullable=False),
        sa.Column('unit', sa.String(length=10), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tab_id'], ['measurement_tabs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
    if op.f('ix_measurement_fields_tab_id') not in existing_indexes.get('measurement_fields', set()):
        op.create_index(op.f('ix_measurement_fields_tab_id'), 'measurement_fields', ['tab_id'])

    # Create order_measurements table
    if 'order_measurements' not in existing_tables:
        op.create_table(
        'order_measurements',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('order_id', sa.String(length=36), nullable=False),
        sa.Column('field_id', sa.String(length=36), nullable=True),
        sa.Column('tab_id', sa.String(length=36), nullable=True),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_type', sa.String(length=50), nullable=False),
        sa.Column('unit', sa.String(length=10), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_id'], ['measurement_fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tab_id'], ['measurement_tabs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
        )
    if op.f('ix_order_measurements_order_id') not in existing_indexes.get('order_measurements', set()):
        op.create_index(op.f('ix_order_measurements_order_id'), 'order_measurements', ['order_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_order_measurements_order_id'), table_name='order_measurements')
    op.drop_table('order_measurements')
    
    op.drop_index(op.f('ix_measurement_fields_tab_id'), table_name='measurement_fields')
    op.drop_table('measurement_fields')
    
    op.drop_index(op.f('ix_measurement_tabs_company_id'), table_name='measurement_tabs')
    op.drop_table('measurement_tabs')
    
    op.drop_index(op.f('ix_order_status_history_order_id'), table_name='order_status_history')
    op.drop_table('order_status_history')
    
    op.drop_index(op.f('ix_orders_due_date'), table_name='orders')
    op.drop_index(op.f('ix_orders_status'), table_name='orders')
    op.drop_index(op.f('ix_orders_customer_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_company_id'), table_name='orders')
    op.drop_table('orders')
    
    op.drop_index(op.f('ix_customers_phone_number'), table_name='customers')
    op.drop_index(op.f('ix_customers_name'), table_name='customers')
    op.drop_index(op.f('ix_customers_company_id'), table_name='customers')
    op.drop_table('customers')
