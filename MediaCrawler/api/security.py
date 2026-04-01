# -*- coding: utf-8 -*-
"""API security helpers for MediaCrawler WebUI server."""

from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import HTTPException, Request, WebSocket, status


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def is_auth_enabled() -> bool:
    # Secure-by-default for networked mode.
    return _to_bool(os.getenv("MEDIACRAWLER_API_AUTH_ENABLED", "true"), default=True)


def get_api_key() -> str:
    return os.getenv("MEDIACRAWLER_API_KEY", "").strip()


def _extract_bearer(auth_header: str) -> str:
    if not auth_header:
        return ""
    prefix = "bearer "
    lower = auth_header.lower()
    if not lower.startswith(prefix):
        return ""
    return auth_header[len(prefix):].strip()


def _validate_token(candidate: str) -> bool:
    expected = get_api_key()
    if not expected:
        return False
    return secrets.compare_digest(candidate, expected)


def _configuration_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="API authentication is enabled but MEDIACRAWLER_API_KEY is not configured",
    )


async def require_api_key(request: Request) -> None:
    if not is_auth_enabled():
        return

    if not get_api_key():
        raise _configuration_error()

    api_key = request.headers.get("x-api-key", "")
    bearer = _extract_bearer(request.headers.get("authorization", ""))

    if _validate_token(api_key) or _validate_token(bearer):
        return

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def websocket_is_authorized(websocket: WebSocket) -> Optional[str]:
    if not is_auth_enabled():
        return None

    if not get_api_key():
        return "API authentication is enabled but MEDIACRAWLER_API_KEY is not configured"

    key_header = websocket.headers.get("x-api-key", "")
    auth_header = websocket.headers.get("authorization", "")
    token_query = websocket.query_params.get("token", "")

    if _validate_token(key_header) or _validate_token(_extract_bearer(auth_header)) or _validate_token(token_query):
        return None

    return "Unauthorized"


def docs_enabled() -> bool:
    # Disabled by default to reduce exposed attack surface.
    return _to_bool(os.getenv("MEDIACRAWLER_ENABLE_DOCS", "false"), default=False)


def trusted_hosts() -> list[str]:
    raw = os.getenv("MEDIACRAWLER_TRUSTED_HOSTS", "localhost,127.0.0.1")
    hosts = [h.strip() for h in raw.split(",") if h.strip()]
    return hosts or ["localhost", "127.0.0.1"]
