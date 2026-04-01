# -*- coding: utf-8 -*-

import os

os.environ["MEDIACRAWLER_API_AUTH_ENABLED"] = "false"

from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_logs_limit_guard():
    resp = client.get("/api/crawler/logs", params={"limit": 1001})
    assert resp.status_code == 400


def test_preview_limit_guard():
    resp = client.get("/api/data/files/x.json", params={"preview": True, "limit": 2000})
    assert resp.status_code == 400
