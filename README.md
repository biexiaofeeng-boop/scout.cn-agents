# scout.cn-agents

统一的中文情报采集与智能分析 Agents 项目。

## 当前组成

- `MediaCrawler/`：多平台内容采集（小红书/抖音/微博等）
- `wechat-spider/`：微信公众号文章、评论、动态采集
- `intel_hub/`：统一数据入湖、去重、重试、DLQ、调度、监控 API
- `ops/`：扫描、启动、状态、停机脚本
- `docs/`：架构与运营文档

## 目标

基于现有采集能力，构建一个面向中文世界的情报 Agents 体系，形成从“采集-标准化-分析-告警-处置”的闭环。

详见：`docs/AGENTS_SYSTEM_BLUEPRINT.md`

## 运营最短路径

1. 运行 `/Users/sourcefire/1data/scout-lab/ops/scan.sh`
2. 修复扫描失败项（当前重点：安装 Docker）
3. 运行 `/Users/sourcefire/1data/scout-lab/ops/start.sh`
4. 运行 `/Users/sourcefire/1data/scout-lab/ops/status.sh`
