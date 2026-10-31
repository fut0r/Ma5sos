import secrets


def generate_qr_code(share_code: str) -> str:
    """Generates a cryptographically unique QR token per guest."""
    token = secrets.token_hex(6).upper()
    return f"QR-{share_code}-{token}"


def generate_invite_token() -> str:
    """An unguessable token for a guest's private invitation link."""
    return secrets.token_urlsafe(24)
