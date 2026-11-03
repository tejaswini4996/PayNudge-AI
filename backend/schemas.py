
from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class InvoiceCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=100)
    customer_email: EmailStr
    description: str = Field(min_length=3, max_length=500)
    amount: float = Field(gt=0, allow_inf_nan=False)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    due_date: date


class Invoice(InvoiceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str = "pending"
