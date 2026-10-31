"""Paylink REST client (developer.paylink.sa), plus a local mock for development."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from api.config import settings

PAYLINK_TEST_URL = "https://restpilot.paylink.sa"
PAYLINK_LIVE_URL = "https://restapi.paylink.sa"

# Paylink sits behind Cloudflare and rejects the default Python urllib
# signature with "Error 1010". A normal browser signature is required even
# though these are server-to-server API calls.
PAYLINK_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

_token: str | None = None
_token_expires = 0.0
_mock_invoices: dict[str, dict[str, Any]] = {}


def paylink_mode() -> str:
    """``mock``, ``test`` or ``production``.

    An explicit PAYLINK_ENV always wins.  Otherwise production sites use the
    real gateway and every other environment uses the local mock; a production
    deployment must never fall back to fake payments silently.
    """
    mode = (settings.PAYLINK_ENV or "").strip().lower()
    if mode in {"mock", "test", "production"}:
        return mode
    if settings.ENVIRONMENT == "production":
        return "production"
    return "mock"


def _live() -> bool:
    return paylink_mode() == "production"


def _base_url() -> str:
    return PAYLINK_LIVE_URL if _live() else PAYLINK_TEST_URL


def _credentials() -> tuple[str, str]:
    api_id = (settings.PAYLINK_API_ID or "").strip()
    secret = (settings.PAYLINK_SECRET_KEY or "").strip()
    return api_id, secret


def _call(path: str, *, method: str = "GET", body: dict | None = None, auth: bool = True) -> Any:
    site = settings.SITE_URL.rstrip("/")
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": PAYLINK_USER_AGENT,
        "accept-language": "ar,en;q=0.9",
        "origin": site,
        "referer": f"{site}/",
    }
    if auth:
        headers["authorization"] = f"Bearer {_get_token()}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(_base_url() + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            text = response.read().decode("utf-8")
            return json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        global _token
        if error.code == 401:
            _token = None
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Paylink {method} {path} → {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Paylink {method} {path} → network error: {error.reason}") from error


def _get_token() -> str:
    global _token, _token_expires
    if _token and time.time() * 1000 < _token_expires:
        return _token
    api_id, secret = _credentials()
    if not api_id or not secret:
        raise RuntimeError("مفاتيح Paylink غير معيّنة. أضف PAYLINK_API_ID و PAYLINK_SECRET_KEY.")
    data = _call(
        "/api/auth",
        method="POST",
        auth=False,
        body={"apiId": api_id, "secretKey": secret, "persistToken": True},
    )
    token = data.get("id_token") if isinstance(data, dict) else None
    if not token:
        raise RuntimeError("Paylink /api/auth returned no id_token")
    _token = token
    _token_expires = time.time() * 1000 + 29 * 60 * 60 * 1000
    return token


def add_invoice(
    *,
    order_number: str,
    amount: float,
    client_name: str,
    client_mobile: str,
    product: dict,
    call_back_url: str,
    cancel_url: str,
) -> dict:
    if paylink_mode() == "mock":
        return _mock_add_invoice(order_number, amount, product, call_back_url, cancel_url)
    invoice = _call(
        "/api/addInvoice",
        method="POST",
        body={
            "orderNumber": order_number,
            "amount": amount,
            "currency": "SAR",
            "callBackUrl": call_back_url,
            "cancelUrl": cancel_url,
            "clientName": client_name,
            "clientMobile": client_mobile,
            "products": [
                {
                    "title": product["title"],
                    "description": product["description"],
                    "price": amount,
                    "qty": 1,
                    "isDigital": True,
                }
            ],
            "displayPending": True,
            "note": f"{product['title']} — {order_number}",
        },
    )
    if not isinstance(invoice, dict):
        raise RuntimeError("Paylink returned an unexpected invoice response.")
    # Paylink has used both spellings across API versions.
    if not invoice.get("url") and invoice.get("paymentUrl"):
        invoice["url"] = invoice["paymentUrl"]
    return invoice


def get_invoice(transaction_no: str) -> dict:
    if paylink_mode() == "mock":
        return _mock_get_invoice(transaction_no)
    invoice = _call(f"/api/getInvoice/{urllib.parse.quote(transaction_no)}")
    if not isinstance(invoice, dict):
        raise RuntimeError("Paylink returned an unexpected invoice response.")
    if invoice.get("paymentReceipt") is None and invoice.get("receipt"):
        invoice["paymentReceipt"] = invoice["receipt"]
    return invoice


def _mock_add_invoice(order_number, amount, product, call_back_url, cancel_url) -> dict:
    transaction_no = f"MOCK{int(time.time() * 1000)}"
    _mock_invoices[transaction_no] = {
        "transactionNo": transaction_no,
        "orderNumber": order_number,
        "amount": amount,
        "product": product,
        "callBackUrl": call_back_url,
        "cancelUrl": cancel_url,
        "orderStatus": "Pending",
    }
    # Relative to the page that opened the checkout: works on localhost and on
    # the live domain without ever pointing guests at the wrong host.
    return {
        "transactionNo": transaction_no,
        "orderStatus": "Pending",
        "url": f"/api/mock-paylink/{transaction_no}",
    }


def _mock_get_invoice(transaction_no: str) -> dict:
    invoice = _mock_invoices.get(transaction_no)
    if not invoice:
        raise RuntimeError(f"Unknown mock invoice {transaction_no}")
    paid = invoice["orderStatus"] == "Paid"
    return {**invoice, "paymentReceipt": {"paymentMethod": "mock"} if paid else None}


def mock_invoice(transaction_no: str) -> dict | None:
    return _mock_invoices.get(transaction_no)


def mark_mock_paid(transaction_no: str) -> None:
    invoice = _mock_invoices.get(transaction_no)
    if invoice:
        invoice["orderStatus"] = "Paid"
