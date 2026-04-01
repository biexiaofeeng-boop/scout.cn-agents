# -*- coding: utf-8 -*-

from api.security import _extract_bearer, websocket_is_authorized
from api.services.crawler_manager import CrawlerManager


class _DummyWS:
    def __init__(self, headers=None, query_params=None):
        self.headers = headers or {}
        self.query_params = query_params or {}


def test_extract_bearer():
    assert _extract_bearer("Bearer abc") == "abc"
    assert _extract_bearer("bearer abc") == "abc"
    assert _extract_bearer("") == ""
    assert _extract_bearer("Token abc") == ""


def test_redact_command():
    cmd = ["uv", "run", "python", "main.py", "--cookies", "secret", "--platform", "xhs"]
    redacted = CrawlerManager._redact_command(cmd)
    assert redacted[5] == "<redacted>"


def test_websocket_auth_disabled(monkeypatch):
    monkeypatch.setenv("MEDIACRAWLER_API_AUTH_ENABLED", "false")
    monkeypatch.delenv("MEDIACRAWLER_API_KEY", raising=False)
    ws = _DummyWS()
    assert websocket_is_authorized(ws) is None


def test_websocket_auth_with_key(monkeypatch):
    monkeypatch.setenv("MEDIACRAWLER_API_AUTH_ENABLED", "true")
    monkeypatch.setenv("MEDIACRAWLER_API_KEY", "k123")
    ws = _DummyWS(headers={"x-api-key": "k123"})
    assert websocket_is_authorized(ws) is None


def test_websocket_auth_unauthorized(monkeypatch):
    monkeypatch.setenv("MEDIACRAWLER_API_AUTH_ENABLED", "true")
    monkeypatch.setenv("MEDIACRAWLER_API_KEY", "k123")
    ws = _DummyWS(headers={"x-api-key": "bad"})
    assert websocket_is_authorized(ws) == "Unauthorized"
