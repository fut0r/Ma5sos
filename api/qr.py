"""Reading the ticket payloads encoded inside a Ma5sos (مخصوص) QR code."""

from __future__ import annotations

import re
from dataclasses import dataclass

TOKEN_RE = re.compile(r"QR-[A-Za-z0-9_-]+", re.IGNORECASE)
PREFIX = "MA5SOS:TICKET:"


@dataclass(frozen=True)
class QrReading:
    kind: str  # "empty" | "ma5sos" | "foreign" | "invalid"
    token: str | None = None
    raw: str = ""
    message: str = ""


def encode_ticket(token: str) -> str:
    value = str(token or "").strip()
    if not value:
        return ""
    upper = value.upper()
    if upper.startswith("MA5SOS:") or upper.startswith("MAZOM:"):
        return value
    return f"{PREFIX}{value}"


def read_qr(raw: str | None) -> QrReading:
    text = str(raw or "").strip()
    if not text:
        return QrReading("empty", message="لم يُقرأ أي رمز. وجّه الكاميرا نحو رمز QR أو ارفع صورة له.")

    match = TOKEN_RE.search(text)
    if match:
        return QrReading("ma5sos", token=match.group(0).upper(), raw=text)

    upper = text.upper()
    lower = text.lower()
    if upper.startswith(("MA5SOS:", "MAZOM:")) or "ma5sos." in lower or "mazom." in lower:
        return QrReading(
            "invalid",
            raw=text,
            message="هذا رمز مخصوص لكنه ليس تذكرة دخول. اطلب من الضيف فتح دعوته وإظهار رمز QR الخاص به.",
        )

    return QrReading(
        "foreign",
        raw=text,
        message="هذا الرمز ليس رمز QR صادرًا من منصة مخصوص. اطلب من الضيف إظهار تذكرة مخصوص الخاصة به.",
    )
