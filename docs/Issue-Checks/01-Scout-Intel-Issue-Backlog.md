# Scout 情报系统 Issue Backlog

## 阶段目标
把现有 `scout-lab` 从“已能启动多个服务”推进到“围绕情报主题可治理运营”。当前 P0 是把 `scout-media-agents` 补成真正的治理控制面。

## P0
- `SM1`: `scout-media-agents` 治理数据模型与 registry 最小闭环
- `SM2`: `scout-media-agents` CLI 审阅/计划/运行可观测入口
- `SW1`: `scout-wchat-agents` seed 导入与公众号任务联动治理
- `SH1`: `scout-ops` 运行状态与 export 结果聚合面

## P1
- `SM3`: LLM expansion 接入 topic profile 与证据记录
- `SM4`: export job 与 analyst-friendly 数据包导出
- `SV1`: `scout-vendor/mediacrawler` 统一 runner 适配层
- `OPS1`: 日常运营 SOP / 巡检 / 告警升级路径

## P2
- `ARCH1`: `scout-media-agents` 深化 TypeScript 化并对接更强 agent 架构
- `DATA1`: 治理 registry 持久化到 MySQL / Postgres
- `OBS1`: 统一 metrics、event log、dashboard

## 当前认领建议
- 当前窗口优先执行 `SM1 + SM2`。
- 完成后再推进 `SW1` 与 `SH1`，把微信任务链路和 hub 导出链路接上治理面。
