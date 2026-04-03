# -*- coding: utf-8 -*-
'''
Created on 2019/5/18 11:54 AM
---------
@summary:
---------
@author:
'''
import os
import socket
import sys
import shutil
from copy import deepcopy

import yaml  # pip3 install pyyaml

if 'python' in sys.executable:
    abs_path = lambda file: os.path.abspath(os.path.join(os.path.dirname(__file__), file))
else:
    abs_path = lambda file: os.path.abspath(os.path.join(os.path.dirname(sys.executable), file))  # mac 上打包后 __file__ 指定的是用户根路径，非当执行文件路径

if not os.path.exists('./config/config.yaml'):
    os.makedirs('./config', exist_ok=True)
    shutil.copyfile('./config.yaml', './config/config.yaml')

with open(abs_path('./config/config.yaml'), encoding='utf8') as _cfg_file:
    config = yaml.safe_load(_cfg_file) or {}


def _apply_env_overrides(cfg: dict) -> dict:
    """Apply env-based secret/connection overrides."""
    conf = deepcopy(cfg)
    mysqldb = conf.setdefault("mysqldb", {})
    redisdb = conf.setdefault("redisdb", {})
    spider = conf.setdefault("spider", {})
    spider_interval = spider.setdefault("spider_interval", {})

    mysqldb["ip"] = os.getenv("WECHAT_MYSQL_HOST", mysqldb.get("ip"))
    mysqldb["port"] = int(os.getenv("WECHAT_MYSQL_PORT", mysqldb.get("port", 3306)))
    mysqldb["db"] = os.getenv("WECHAT_MYSQL_DB", mysqldb.get("db"))
    mysqldb["user"] = os.getenv("WECHAT_MYSQL_USER", mysqldb.get("user"))
    mysqldb["passwd"] = os.getenv("WECHAT_MYSQL_PASSWD", mysqldb.get("passwd"))

    redisdb["ip"] = os.getenv("WECHAT_REDIS_HOST", redisdb.get("ip"))
    redisdb["port"] = int(os.getenv("WECHAT_REDIS_PORT", redisdb.get("port", 6379)))
    redisdb["db"] = int(os.getenv("WECHAT_REDIS_DB", redisdb.get("db", 0)))
    redisdb["passwd"] = os.getenv("WECHAT_REDIS_PASSWD", redisdb.get("passwd"))

    spider["service_host"] = os.getenv("WECHAT_SERVICE_HOST", spider.get("service_host", "0.0.0.0"))
    spider["service_port"] = int(os.getenv("WECHAT_SERVICE_PORT", spider.get("service_port", 8080)))
    spider["monitor_interval"] = int(os.getenv("WECHAT_MONITOR_INTERVAL_SEC", spider.get("monitor_interval", 3600)))
    spider["no_task_sleep_time"] = int(os.getenv("WECHAT_NO_TASK_SLEEP_SEC", spider.get("no_task_sleep_time", 3600)))
    spider_interval["min_sleep_time"] = int(
        os.getenv("WECHAT_SPIDER_MIN_SLEEP_SEC", spider_interval.get("min_sleep_time", 5))
    )
    spider_interval["max_sleep_time"] = int(
        os.getenv("WECHAT_SPIDER_MAX_SLEEP_SEC", spider_interval.get("max_sleep_time", 10))
    )

    return conf


config = _apply_env_overrides(config)


def get_host_ip():
    """
    利用 UDP 协议来实现的，生成一个UDP包，把自己的 IP 放如到 UDP 协议头中，然后从UDP包中获取本机的IP。
    这个方法并不会真实的向外部发包，所以用抓包工具是看不到的
    :return:
    """
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    finally:
        if s:
            s.close()

    return ip


IP = get_host_ip()
