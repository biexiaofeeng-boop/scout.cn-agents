# scout.cn-agents

统一的中文情报采集与智能分析 Agents 项目。

## 当前组成

- `scout-vendor/`：统一数据获取边界，包含 MediaCrawler、Steam/YouTube/Reddit provider wrappers 等
- `wechat-spider/`：微信公众号文章、评论、动态采集
- `intel_hub/`：统一数据入湖、去重、重试、DLQ、调度、监控 API
- `scout-hub/`：TypeScript 控制面（阶段 A+B）
- `scout-media-agents/`：MediaCrawler 的 TS 适配工程
- `scout-wchat-agents/`：wechat-spider 的 TS 适配工程
- `ops/`：扫描、启动、状态、停机脚本
- `docs/`：架构与运营文档

## 目标

基于现有采集能力，构建一个面向多业务领域的情报 Agents 体系，形成从“topic-采集-标准化-分析-告警-处置/handoff”的闭环。

详见：`docs/AGENTS_SYSTEM_BLUEPRINT.md`
迁移执行：`docs/TS_MIGRATION_STAGES.md`
运行态与 vendor 边界：`docs/SCOUT_RUNTIME_AND_VENDOR_STRATEGY.md`

## 许可证

- 本仓库中由当前项目新增的控制面、适配层、部署脚本、文档与运维脚本，按 Apache 2.0 发布，见 `LICENSE`
- `scout-vendor/mediacrawler/` 保留其上游 `NON-COMMERCIAL LEARNING LICENSE 1.1`，见 `scout-vendor/mediacrawler/LICENSE`
- `wechat-spider/` 在当前快照里未发现明确的 Apache 兼容上游授权，不在本次 Apache 2.0 重授权范围内
- 具体边界见 `NOTICE`

## 运营最短路径

1. 运行 `/Users/sourcefire/1data/scout-lab/ops/scan.sh`
2. 修复扫描失败项（当前重点：安装 Docker）
3. 运行 `/Users/sourcefire/1data/scout-lab/ops/start.sh`
4. 运行 `/Users/sourcefire/1data/scout-lab/ops/status.sh`
