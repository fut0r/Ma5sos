"""Datetime helpers shared by the API's output schemas.

SQLite drops the timezone from a stored datetime, so a value that was written
as UTC comes back without an offset.  Serialising it as ``…Z`` (or ``+00:00``)
keeps the browser from reading a Riyadh event three hours early.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
