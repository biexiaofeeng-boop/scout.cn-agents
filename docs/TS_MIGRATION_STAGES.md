# TypeScript 迁移执行方案（里程碑制）

目标：不改动现有 Python 代码，先建立 TS 控制面与适配层，再逐个迁移。

## 项目边界

- `scout-hub/`：TS 控制面（统一入湖、调度、监控）
- `scout-media-agents/`：MediaCrawler 适配工程
- `scout-wchat-agents/`：wechat-spider 适配工程

## M0: 并行基线

完成标准：

1. 三个 TS 项目可独立安装依赖并运行基础命令。
2. 不改动 `MediaCrawler/` 和 `wechat-spider/` 的核心逻辑。
3. 所有输出数据可回溯到原始数据源。

## M1: 阶段 A（TS Hub 可运行）

完成标准：

1. `scout-hub` 能执行一次完整 pipeline run。
2. 支持增量游标、去重写入、DLQ 记录。
3. 对外提供 `/health` `/metrics` `/runs` `/alerts` `/run-once`。

验收命令：

```bash
cd /Users/sourcefire/1data/scout-lab/scout-hub
npm install
npm run pipeline:once
npm run api
```

## M2: 阶段 B（Python 采集器接入 TS 控制面）

完成标准：

1. `MediaCrawler` 数据目录可被 `scout-hub` 增量消费。
2. `wechat-spider` MySQL 数据可被 `scout-hub` 增量消费。
3. 失败事件进入 DLQ，不影响主流程持续运行。

验收口径：

1. `runs` 有连续记录。
2. `totalEvents` 稳定增长。
3. `alerts` 可反映故障状态。

## M3: 逐平台迁移（后续）

完成标准：

1. 每完成一个平台适配器，即可切换该平台到 TS 侧。
2. 保留 Python sidecar 作为回退路径，直到该平台稳定。
3. 全平台迁移后再下线 Python 数据接入。

## 风险控制

1. 一次只迁一个能力边界（不要跨层同时改）。
2. 每次迁移必须保留回滚命令与回放样本。
3. 新旧路径并行跑，至少累计多轮回测后再切流。
