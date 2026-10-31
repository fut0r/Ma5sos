"""Saudi mobile numbers — same rules as src/lib/phone.js."""

import re

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def normalize_saudi_mobile(value: str | None) -> str | None:
    """Return +9665XXXXXXXX, or None if the input is not a Saudi mobile number."""
    if value is None:
        return None
    digits = str(value).translate(ARABIC_DIGITS)
    digits = re.sub(r"[\s\-().]", "", digits)
    if digits.startswith("+"):
        digits = digits[1:]
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("966"):
        digits = digits[3:]
    if digits.startswith("0"):
        digits = digits[1:]
    if re.fullmatch(r"5\d{8}", digits):
        return f"+966{digits}"
    return None


def phone_variants(normalized: str) -> list[str]:
    """All common writings of one Saudi mobile, for lookup of older rows."""
    if not normalized:
        return []
    local = f"0{normalized[4:]}"
    national = normalized[4:]
    return list(
        dict.fromkeys(
            [
                normalized,
                normalized[1:],  # 9665XXXXXXXX
                local,  # 05XXXXXXXX
                national,  # 5XXXXXXXX
            ]
        )
    )


def local_saudi_mobile(normalized: str) -> str:
    return f"0{normalized[4:]}"
