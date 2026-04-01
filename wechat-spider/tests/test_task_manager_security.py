from __future__ import annotations

import sys
from pathlib import Path
import types

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "wechat-spider"))

# Lightweight stubs to avoid external runtime dependencies during unit tests.
fake_mysqldb = types.ModuleType("db.mysqldb")
fake_mysqldb.MysqlDB = object
sys.modules["db.mysqldb"] = fake_mysqldb

fake_redisdb = types.ModuleType("db.redisdb")
fake_redisdb.RedisDB = object
sys.modules["db.redisdb"] = fake_redisdb

fake_tools = types.ModuleType("utils.tools")
fake_tools.get_current_date = lambda date_format="%Y-%m-%d %H:%M:%S": "2026-01-01 00:00:00"
fake_tools.timestamp_to_date = lambda ts: "2026-01-01 00:00:00"
fake_tools.get_current_timestamp = lambda: 0
sys.modules["utils.tools"] = fake_tools

fake_log_mod = types.ModuleType("utils.log")
class _Log:
    def error(self, *args, **kwargs):
        return None
fake_log_mod.log = _Log()
sys.modules["utils.log"] = fake_log_mod

fake_config_mod = types.ModuleType("config")
fake_config_mod.config = {"spider": {"crawl_time_range": "~"}}
sys.modules["config"] = fake_config_mod

from core.task_manager import TaskManager


class _RedisStub:
    def __init__(self, payload):
        self.payload = payload

    def zget(self, key, is_pop=True):
        if self.payload is None:
            return []
        return [self.payload]


def test_parse_json_task():
    mgr = TaskManager.__new__(TaskManager)
    mgr._redis = _RedisStub('{"article_url": "https://example.com"}')
    task = mgr._TaskManager__get_task_from_redis('k')
    assert task["article_url"] == "https://example.com"


def test_reject_non_literal_payload():
    mgr = TaskManager.__new__(TaskManager)
    mgr._redis = _RedisStub("__import__('os').system('echo hacked')")
    task = mgr._TaskManager__get_task_from_redis('k')
    assert task is None
