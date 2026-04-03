# Docker Step By Step

## Step 0: 安装 Docker Desktop（只做一次）

```bash
brew install --cask docker
```

然后手动打开 `Docker` 应用，等待状态变为 running。

## Step 1: 初始化本项目部署配置

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./bootstrap.sh
```

## Step 2: 修改环境文件（必须）

编辑：

- `/Users/sourcefire/1data/scout-lab/scout-deploy/env/scout-hub.env`
- `/Users/sourcefire/1data/scout-lab/scout-deploy/env/scout-wchat.env`

要求：

1. 两个文件里的 `WECHAT_MYSQL_PASSWD` 必须一致。
2. 不要保留 `CHANGE_ME`。
3. 如果先不接微信库，可设 `SCOUT_WECHAT_ENABLE_DB=false`。
4. 推荐周期（可按需调）：
   - `SCOUT_SCHEDULER_INTERVAL_SEC=120`（hub 调度周期）
   - `WECHAT_MONITOR_INTERVAL_SEC=300`（公众号轮询周期）
   - `WECHAT_NO_TASK_SLEEP_SEC=60`（无任务重试周期）

## Step 3: 启动前检查

```bash
./docker-check.sh
```

## Step 4: 启动容器栈

```bash
./docker-up.sh
```

这会启动：

- `mariadb`
- `redis`
- `wechat-spider`
- `scout-hub-api`
- `scout-hub-scheduler`

## Step 5: 查看运行状态

```bash
./docker-status.sh
```

注意：
- 只执行脚本命令本身，例如 `./docker-status.sh`。
- 不要把输出里的 `[PASS] ...`、`[BAD] ...`、`SUMMARY ...` 再复制回终端执行。

## Step 6: 查看日志

```bash
./docker-logs.sh
./docker-logs.sh scout-hub-api
./docker-logs.sh wechat-spider
```

## Step 6.1: 初始化公众号任务（必须）

```bash
./seed-account-task.sh MzIxNzg1ODQ0MQ==
```

可一次传多个 `__biz`：

```bash
./seed-account-task.sh bizA bizB bizC
```

## Step 6.2: 清理历史告警基线（可选）

```bash
./reset-pipeline-warnings.sh
```

## Step 7: 停止服务

```bash
./docker-down.sh
```
