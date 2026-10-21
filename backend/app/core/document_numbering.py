from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderDocumentNumbering


async def lock_order_document_numbering(
    db: AsyncSession,
    company_id: str,
) -> OrderDocumentNumbering:
    numbering = (
        await db.execute(
            select(OrderDocumentNumbering)
            .where(OrderDocumentNumbering.company_id == company_id)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if numbering is None:
        numbering = OrderDocumentNumbering(company_id=company_id)
        db.add(numbering)
        await db.flush()
    return numbering


async def allocate_order_number(
    db: AsyncSession,
    company_id: str,
    numbering: OrderDocumentNumbering | None = None,
) -> str:
    if numbering is None:
        numbering = await lock_order_document_numbering(db, company_id)
    while True:
        number = numbering.next_number
        numbering.next_number += 1
        order_number = f"{numbering.prefix}{number:06d}"
        existing = await db.execute(
            select(Order.id).where(
                Order.company_id == company_id,
                Order.order_number == order_number,
            )
        )
        if existing.scalar_one_or_none() is None:
            return order_number
