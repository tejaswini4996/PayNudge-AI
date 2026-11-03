
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from database import Base, SessionLocal, engine
from models import InvoiceModel
from schemas import Invoice, InvoiceCreate
from reminder_service import generate_reminder, get_reminder_schedule
from paypal_service import create_paypal_order, capture_paypal_order


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="PayNudge AI",
    description="AI-powered invoice collection and payment reminders",
    version="0.2.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Health endpoints
@app.get("/")
def root():
    return {"message": "Welcome to PayNudge AI API"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# Create invoice
@app.post(
    "/api/invoices",
    response_model=Invoice,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
):
    db_invoice = InvoiceModel(**invoice.model_dump())

    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    return db_invoice


# Get all invoices
@app.get("/api/invoices", response_model=list[Invoice])
def get_invoices(db: Session = Depends(get_db)):
    result = db.scalars(
        select(InvoiceModel).order_by(InvoiceModel.id.desc())
    ).all()

    return result


# Get invoice by ID
@app.get("/api/invoices/{invoice_id}", response_model=Invoice)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return invoice


# Delete invoice
@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    db.delete(invoice)
    db.commit()

    return {"message": "Invoice deleted successfully"}


# Update invoice status (development endpoint)
@app.patch("/api/invoices/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    new_status = payload.get("status")

    if new_status not in ["pending", "paid", "overdue"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid invoice status",
        )

    invoice.status = new_status
    db.commit()
    db.refresh(invoice)

    return {
        "message": "Invoice status updated",
        "invoice_id": invoice.id,
        "status": invoice.status,
    }


# Generate AI payment reminder
@app.post("/api/invoices/{invoice_id}/reminder")
def create_reminder(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return generate_reminder(invoice)


# Get reminder schedule
@app.get("/api/invoices/{invoice_id}/schedule")
def get_invoice_schedule(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return get_reminder_schedule(
        invoice.due_date,
        invoice.status,
    )


# Create PayPal order
@app.post("/api/invoices/{invoice_id}/paypal-order")
async def create_invoice_paypal_order(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    if invoice.status == "paid":
        raise HTTPException(
            status_code=400,
            detail="Invoice is already paid",
        )

    if invoice.paypal_order_id:
        raise HTTPException(
            status_code=409,
            detail="A PayPal order already exists for this invoice",
        )

    try:
        result = await create_paypal_order(
            invoice.id,
            Decimal(str(invoice.amount)),
            invoice.currency,
            invoice.description,
        )

        order_id = (
            result.get("paypal_order_id")
            or result.get("order_id")
            or result.get("id")
        )

        if not order_id:
            raise HTTPException(
                status_code=502,
                detail="PayPal did not return an order ID",
            )

        invoice.paypal_order_id = order_id

        db.commit()
        db.refresh(invoice)

        return result

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"PayPal order creation failed: {str(exc)}",
        )


# Capture PayPal payment
@app.post("/api/invoices/{invoice_id}/capture-payment")
async def capture_invoice_payment(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(InvoiceModel, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    if invoice.status == "paid":
        raise HTTPException(
            status_code=400,
            detail="Invoice is already paid",
        )

    if not invoice.paypal_order_id:
        raise HTTPException(
            status_code=400,
            detail="No PayPal order exists for this invoice",
        )

    try:
        result = await capture_paypal_order(
            invoice.paypal_order_id
        )

        if result.get("status") != "COMPLETED":
            raise HTTPException(
                status_code=502,
                detail="PayPal could not capture this order. Check its approval status.",
            )

        purchase_units = result.get("purchase_units", [])

        if not purchase_units:
            raise HTTPException(
                status_code=502,
                detail="PayPal response contains no purchase units",
            )

        purchase_unit = purchase_units[0]

        if purchase_unit.get("custom_id") != str(invoice.id):
            raise HTTPException(
                status_code=400,
                detail="PayPal invoice reference does not match",
            )

        amount_data = purchase_unit.get("amount", {})

        if amount_data.get("currency_code") != invoice.currency:
            raise HTTPException(
                status_code=400,
                detail="Payment currency does not match invoice currency",
            )

        if Decimal(str(amount_data.get("value"))) != Decimal(
            str(invoice.amount)
        ):
            raise HTTPException(
                status_code=400,
                detail="Payment amount does not match invoice amount",
            )

        captures = (
            purchase_unit.get("payments", {}).get("captures", [])
        )

        if not captures or captures[0].get("status") != "COMPLETED":
            raise HTTPException(
                status_code=502,
                detail="PayPal capture is not completed",
            )

        capture_id = captures[0].get("id")

        if not capture_id:
            raise HTTPException(
                status_code=502,
                detail="PayPal capture ID is missing",
            )

        invoice.status = "paid"
        invoice.paypal_capture_id = capture_id

        db.commit()
        db.refresh(invoice)

        return {
            "message": "Payment captured successfully",
            "invoice_id": invoice.id,
            "status": invoice.status,
            "paypal_order_id": invoice.paypal_order_id,
            "paypal_capture_id": invoice.paypal_capture_id,
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"PayPal payment capture failed: {str(exc)}",
        )
