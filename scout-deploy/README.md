# scout-deploy

面向迁移目标组件（`scout-hub` / `scout-media-agents` / `scout-wchat-agents`）的部署脚本目录。

## 目录

- `bootstrap.sh`：初始化 env 与安装依赖
- `check.sh`：环境与配置扫描
- `run-once.sh`：执行一次 `scout-hub` pipeline
- `start.sh`：启动 `scout-hub` API + scheduler（后台）
- `status.sh`：查看进程与健康状态
- `probe.sh`：执行 media/wchat 适配探测
- `stop.sh`：停止后台服务
- `docker-check.sh`：Docker 环境与配置检查
- `docker-up.sh`：启动 Docker 编排栈
- `docker-status.sh`：查看容器与健康状态
- `docker-logs.sh`：查看容器日志
- `docker-down.sh`：停止 Docker 栈
- `seed-account-task.sh`：批量下发 `wechat_account_task`（初始化 `__biz` 任务）
- `reset-pipeline-warnings.sh`：清理历史失败告警基线（保留备份）
- `env/*.env.example`：配置模板

## 快速使用

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./bootstrap.sh
./check.sh
./start.sh
./status.sh
./probe.sh
```

命令行临时变量优先生效，例如：

```bash
SCOUT_WECHAT_ENABLE_DB=false ./run-once.sh
SCOUT_WECHAT_ENABLE_DB=false ./start.sh
```

## Docker 模式（推荐）

先看教程：`DOCKER_STEP_BY_STEP.md`

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./docker-check.sh
./docker-up.sh
./docker-status.sh
./docker-logs.sh scout-hub-api
./docker-down.sh
```

## 运行输出

- PID: `/Users/sourcefire/1data/scout-lab/runtime/scout-deploy/pids`
- 日志: `/Users/sourcefire/1data/scout-lab/runtime/scout-deploy/logs`
