
import os
from datetime import date, timedelta

from groq import Groq
from models import InvoiceModel


def generate_reminder(invoice: InvoiceModel) -> dict:
    today = date.today()

    if invoice.due_date < today:
        days_overdue = (today - invoice.due_date).days
        timing = f"overdue by {days_overdue} days"
        tone = "firm but polite"
    elif invoice.due_date == today:
        timing = "due today"
        tone = "friendly and polite"
    else:
        timing = f"due on {invoice.due_date.isoformat()}"
        tone = "friendly and professional"

    subject = f"Payment reminder: {invoice.description}"

    prompt = f"""
Write a personalized payment reminder email.

Customer name: {invoice.customer_name}
Invoice description: {invoice.description}
Amount: {invoice.currency} {invoice.amount:.2f}
Due date: {invoice.due_date.isoformat()}
Payment status: {timing}
Tone: {tone}

Requirements:
- Address the customer by name.
- Mention the invoice description, amount, and due date or payment status.
- Politely request payment.
- Keep the email concise and professional.
- Thank the customer.
- Do not invent payment links or invoice details.
- Return only the email body, without a subject line.
- Do not include a signature, sender name, company name, or placeholders.
- Never write [Your Name], [Your Company], or [Contact Information].
- End the email with "Thank you." only.
- Do not use Markdown formatting.
- Use normal readable English characters.
"""

    message = None
    ai_generated = False
    api_key = os.getenv("GROQ_API_KEY")

    if api_key:
        try:
            client = Groq(api_key=api_key)

            response = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You write concise, professional invoice "
                            "payment reminders. Never add signatures "
                            "or placeholders."
                        ),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                max_tokens=250,
                temperature=0.3,
            )

            generated_message = response.choices[0].message.content

            if generated_message:
                message = generated_message.strip()

                # Remove unwanted signature placeholders.
                unwanted_phrases = [
                    "[Your Name]",
                    "[Your Company]",
                    "[Contact Information]",
                    "Best regards,",
                    "Kind regards,",
                    "Sincerely,",
                ]

                for phrase in unwanted_phrases:
                    message = message.replace(phrase, "").strip()

                ai_generated = bool(message)

        except Exception as error:
            print(f"Groq reminder generation failed: {error}")

    if not message:
        ai_generated = False
        message = (
            f"Hello {invoice.customer_name},\n\n"
            f"This is a {tone} reminder regarding your invoice "
            f"for {invoice.description}, amounting to "
            f"{invoice.currency} {invoice.amount:.2f}. "
            f"The payment is {timing}.\n\n"
            "Please arrange payment at your convenience. "
            "If you have already paid, please disregard this reminder.\n\n"
            "Thank you."
        )

    return {
        "invoice_id": invoice.id,
        "customer_email": invoice.customer_email,
        "subject": subject,
        "message": message,
        "tone": tone,
        "ai_generated": ai_generated,
    }


def get_reminder_schedule(due_date: date, status: str) -> dict:
    today = date.today()

    if status == "paid":
        return {
            "status": "paid",
            "next_reminder_date": None,
            "message": "No reminder needed for a paid invoice.",
        }

    if due_date < today:
        next_date = today + timedelta(days=3)
        stage = "overdue"

    elif due_date == today:
        next_date = today + timedelta(days=1)
        stage = "due_today"

    else:
        next_date = due_date - timedelta(days=3)

        if next_date < today:
            next_date = today

        stage = "upcoming"

    return {
        "status": stage,
        "next_reminder_date": next_date.isoformat(),
        "message": "Reminder scheduled for the calculated date.",
    }
