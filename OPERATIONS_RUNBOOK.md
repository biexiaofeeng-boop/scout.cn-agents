# Scout Lab 正式运营启动手册

## 1. 体系目标

当前目录包含三个运行单元：

- `/Users/sourcefire/1data/scout-lab/MediaCrawler`：多平台内容抓取与 WebUI/API。
- `/Users/sourcefire/1data/scout-lab/wechat-spider`：公众号抓取与动态数据入库（MySQL/Redis）。
- `/Users/sourcefire/1data/scout-lab/intel_hub`：统一采集、去重入湖、重试、DLQ、调度、监控 API。

推荐生产链路：

1. 平台抓取（MediaCrawler + wechat-spider）
2. 统一入湖（intel_hub pipeline/scheduler）
3. 健康与告警（intel_hub monitor API）

## 2. 一次性准备

先安装基础依赖（Mac 示例）：

```bash
brew install python@3.11 docker curl
```

然后初始化脚本与 Python 运行环境：

```bash
/Users/sourcefire/1data/scout-lab/ops/bootstrap.sh
```

如果要完整安装 MediaCrawler 全量依赖（更慢）：

```bash
/Users/sourcefire/1data/scout-lab/ops/bootstrap.sh --full-mediacrawler
```

## 3. 配置填充（必须）

编辑以下 3 个文件：

- `/Users/sourcefire/1data/scout-lab/ops/env/mediacrawler.env`
- `/Users/sourcefire/1data/scout-lab/ops/env/wechat.env`
- `/Users/sourcefire/1data/scout-lab/ops/env/intel_hub.env`

关键项：

- `MEDIACRAWLER_API_KEY` 必须改为强随机值。
- `MEDIACRAWLER_API_AUTH_ENABLED=true`。
- `MEDIACRAWLER_TRUSTED_HOSTS` 禁止 `*`。
- `WECHAT_MYSQL_PASSWD` 必须改为强口令。
- `INTEL_WECHAT_ENABLE_DB=true`（联通微信数据时）。

## 4. 启动前扫描（必须通过）

```bash
/Users/sourcefire/1data/scout-lab/ops/scan.sh
```

判定规则：

- `FAIL=0` 才允许进入正式启动。
- `WARN>0` 需要人工确认风险。

## 5. 正式启动顺序

```bash
/Users/sourcefire/1data/scout-lab/ops/start.sh
```

该脚本按顺序执行：

1. 启动 `wechat-spider` docker 组件（mariadb/redis/wechat-spider）。
2. 启动 `MediaCrawler API`（默认 8080）。
3. 启动 `intel_hub scheduler`（默认每 300 秒）。
4. 启动 `intel_hub monitor API`（默认 18080）。

## 6. 启动后验收

查看运行状态：

```bash
/Users/sourcefire/1data/scout-lab/ops/status.sh
```

关键健康检查：

```bash
curl -sS http://127.0.0.1:8080/api/health
curl -sS http://127.0.0.1:18080/health
curl -sS http://127.0.0.1:18080/alerts
curl -sS http://127.0.0.1:18080/runs
```

## 7. 日常运营与阈值

建议巡检频率：

- 每 5 分钟检查 `/health` 与 `/alerts`。
- 每 1 小时检查 `intel_pipeline_runs` 的失败数。

建议阈值：

- `INTEL_ALERT_DLQ_THRESHOLD=10`（DLQ 超阈值触发告警）。
- 30 分钟内连续失败 >= 3 次，触发人工介入。

## 8. 回滚与停机

紧急停机：

```bash
/Users/sourcefire/1data/scout-lab/ops/stop.sh
```

回滚策略：

1. 停止全部进程与容器。
2. 回退配置文件（`ops/env/*.env`）。
3. 回退代码到上一个稳定版本。
4. 重新执行 `scan.sh`，确认 `FAIL=0` 后再启动。

## 9. 日志与定位

日志目录：

- `/Users/sourcefire/1data/scout-lab/runtime/logs`

常用排查：

```bash
tail -n 200 /Users/sourcefire/1data/scout-lab/runtime/logs/mediacrawler_api.log
tail -n 200 /Users/sourcefire/1data/scout-lab/runtime/logs/intel_scheduler.log
tail -n 200 /Users/sourcefire/1data/scout-lab/runtime/logs/intel_monitor.log
```
