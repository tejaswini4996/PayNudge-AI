
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class InvoiceModel(Base):
    paypal_order_id: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )
    paypal_capture_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(254), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

