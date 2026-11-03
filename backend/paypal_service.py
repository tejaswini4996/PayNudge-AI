import os
from decimal import Decimal

import httpx
from fastapi import HTTPException


def get_paypal_config():
    client_id = os.getenv("PAYPAL_CLIENT_ID")
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
    base_url = os.getenv(
        "PAYPAL_BASE_URL",
        "https://api-m.sandbox.paypal.com",
    )

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="PayPal credentials are not configured",
        )

    return client_id, client_secret, base_url.rstrip("/")


async def create_paypal_order(
    invoice_id: int,
    amount: Decimal,
    currency: str,
    description: str,
) -> dict:
    client_id, client_secret, base_url = get_paypal_config()

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_response = await client.post(
                f"{base_url}/v1/oauth2/token",
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
            )
            token_response.raise_for_status()
            access_token = token_response.json()["access_token"]

            order_payload = {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": str(invoice_id),
                        "custom_id": str(invoice_id),
                        "description": description[:127],
                        "amount": {
                            "currency_code": currency,
                            "value": format(
                                amount.quantize(Decimal("0.01")),
                                ".2f",
                            ),
                        },
                    }
                ],
                "application_context": {
                    "brand_name": "PayNudge AI",
                    "user_action": "PAY_NOW",
                },
            }

            order_response = await client.post(
                f"{base_url}/v2/checkout/orders",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=order_payload,
            )
            order_response.raise_for_status()
            order = order_response.json()

            approval_url = next(
                (
                    link["href"]
                    for link in order.get("links", [])
                    if link.get("rel") == "approve"
                ),
                None,
            )

            if not approval_url:
                raise HTTPException(
                    status_code=502,
                    detail="PayPal did not return an approval link",
                )

            return {
                "invoice_id": invoice_id,
                "paypal_order_id": order["id"],
                "status": order["status"],
                "approval_url": approval_url,
            }

    except httpx.HTTPStatusError as exc:
        # Avoid returning credentials or raw provider error details.
        raise HTTPException(
            status_code=502,
            detail="PayPal rejected the request. Check Sandbox credentials and API configuration.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to PayPal Sandbox",
        ) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Unexpected response from PayPal",
        ) from exc


async def capture_paypal_order(order_id: str) -> dict:
    client_id, client_secret, base_url = get_paypal_config()

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_response = await client.post(
                f"{base_url}/v1/oauth2/token",
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
            )
            token_response.raise_for_status()
            access_token = token_response.json()["access_token"]

            response = await client.post(
                f"{base_url}/v2/checkout/orders/{order_id}/capture",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={},
            )
            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail="PayPal could not capture this order. Check its approval status.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to PayPal Sandbox",
        ) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Unexpected response from PayPal",
        ) from exc
