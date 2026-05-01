import secrets

import httpx
from fastapi import HTTPException, Request

from .config import Settings
from .rate_limit import client_ip

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


async def verify_captcha(request: Request, settings: Settings) -> None:
    if not settings.captcha_required and not settings.turnstile_secret_key:
        return

    token = request.headers.get("x-captcha-token")
    if not token:
        raise HTTPException(status_code=400, detail="CAPTCHA token is required")

    if not settings.turnstile_secret_key:
        raise HTTPException(status_code=500, detail="CAPTCHA is not configured")

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(
            TURNSTILE_VERIFY_URL,
            data={
                "secret": settings.turnstile_secret_key,
                "response": token,
                "remoteip": client_ip(request, trust_proxy_headers=settings.trust_proxy_headers),
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="CAPTCHA verification failed")

    result = response.json()
    if not result.get("success"):
        raise HTTPException(status_code=400, detail="CAPTCHA verification failed")


def verify_admin_key(request: Request, settings: Settings) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="Reports are not configured")

    provided_key = request.headers.get("x-admin-key", "")
    if not secrets.compare_digest(provided_key, settings.admin_api_key):
        raise HTTPException(status_code=403, detail="Admin access required")


def csv_safe_text(value: object) -> str:
    text = "" if value is None else str(value)
    if text.lstrip().startswith(CSV_FORMULA_PREFIXES):
        return f"'{text}"
    return text
