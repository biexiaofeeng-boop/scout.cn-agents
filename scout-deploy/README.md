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

## 运行输出

- PID: `/Users/sourcefire/1data/scout-lab/runtime/scout-deploy/pids`
- 日志: `/Users/sourcefire/1data/scout-lab/runtime/scout-deploy/logs`
