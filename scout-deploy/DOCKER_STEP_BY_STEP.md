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

## Step 6: 查看日志

```bash
./docker-logs.sh
./docker-logs.sh scout-hub-api
./docker-logs.sh wechat-spider
```

## Step 7: 停止服务

```bash
./docker-down.sh
```
