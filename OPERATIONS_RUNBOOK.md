# Scout Lab 正式运营启动手册

## 0. 现状说明（2026-05 更新）

本手册原本针对 `intel_hub`（Python）的运行链路。当前生产链路重心已迁移
到 `scout-hub`（TypeScript）的 Ops Console + Schedules：

- 游戏类素材采集走 Steam / YouTube / Reddit。运营员在 `http://127.0.0.1:18080/ops`
  手动触发，或通过 Schedules 定时执行；产物全部进 review queue 等审阅。
- `intel_hub`、`mediacrawler`、`wechat-spider` 暂时冻结，不再投入新功能。
  `scout-hub-scheduler` 容器默认不调用 `pipeline.runOnce()`
  （`SCOUT_PIPELINE_TICK_ENABLED=false`）。
- scout-hub 的启动、配置、调度、测试细节见
  `/Users/sourcefire/1data/scout-lab/scout-hub/README.md`。

下面"intel_hub 启动"相关章节（第 1 节起）仅在确实需要重新启用旧链路时
使用。新人上手优先看 scout-hub README。

## 1. 体系目标

当前目录包含三个运行单元：

- `/Users/sourcefire/1data/scout-lab/scout-vendor/mediacrawler`：多平台内容抓取与 WebUI/API。
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

- `MEDIACRAWLER_API_PORT=18081`（当前默认值，可按需调整）。
- `MEDIACRAWLER_API_KEY` 当前是预留字段，未来补鉴权层时会用到。
- `MEDIACRAWLER_TRUSTED_HOSTS` 当前也是预留字段，不是现阶段主安全边界。
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
2. 启动 `MediaCrawler API`（默认 18081）。
3. 启动 `intel_hub scheduler`（默认每 300 秒）。
4. 启动 `intel_hub monitor API`（默认 18080）。

## 6. 启动后验收

查看运行状态：

```bash
/Users/sourcefire/1data/scout-lab/ops/status.sh
```

关键健康检查：

```bash
curl -sS http://127.0.0.1:18081/api/health
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
