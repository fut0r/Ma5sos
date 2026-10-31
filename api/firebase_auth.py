"""Verify Firebase phone-auth ID tokens without a service-account key."""

from __future__ import annotations

import json
import time
import urllib.request

from jose import JWTError, jwt

from api.config import settings

_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
_USER_AGENT = "Mozilla/5.0 (compatible; Ma5sos/1.0; +https://www.ma5sos.com)"

_certs: dict[str, str] = {}
_certs_expire_at = 0.0


def _load_certs(force: bool = False) -> dict[str, str]:
    global _certs, _certs_expire_at
    now = time.time()
    if not force and _certs and now < _certs_expire_at:
        return _certs

    request = urllib.request.Request(_CERTS_URL, headers={"user-agent": _USER_AGENT})
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
        cache_control = response.headers.get("cache-control", "")
        max_age = 3600
        for part in cache_control.split(","):
            part = part.strip()
            if part.startswith("max-age="):
                try:
                    max_age = max(60, int(part.split("=", 1)[1]))
                except ValueError:
                    pass
    if not isinstance(payload, dict):
        raise RuntimeError("Firebase public certificates were not a JSON object.")
    _certs = {str(key): str(value) for key, value in payload.items()}
    _certs_expire_at = now + max_age
    return _certs


def verify_firebase_id_token(id_token: str) -> dict:
    """Return the verified claims, or raise ValueError for an invalid token."""
    token = (id_token or "").strip()
    if not token:
        raise ValueError("missing Firebase ID token")

    project_id = (settings.FIREBASE_PROJECT_ID or "").strip()
    if not project_id:
        raise ValueError("FIREBASE_PROJECT_ID is not configured")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as error:
        raise ValueError("invalid Firebase ID token") from error

    kid = str(header.get("kid") or "")
    if not kid:
        raise ValueError("Firebase ID token has no key id")

    certs = _load_certs()
    certificate = certs.get(kid)
    if not certificate:
        certs = _load_certs(force=True)
        certificate = certs.get(kid)
    if not certificate:
        raise ValueError("unknown Firebase signing key")

    try:
        claims = jwt.decode(
            token,
            certificate,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except JWTError as error:
        raise ValueError("invalid Firebase ID token") from error

    if not claims.get("sub"):
        raise ValueError("Firebase ID token has no subject")
    provider = ((claims.get("firebase") or {}).get("sign_in_provider") or "").strip()
    if provider != "phone":
        raise ValueError("Firebase ID token is not from phone authentication")
    if not claims.get("phone_number"):
        raise ValueError("Firebase ID token has no phone number")
    return claims
