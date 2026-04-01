# Agents Workspace

本目录用于承载中文情报助手的 Agents 能力。

## 建议拆分

- `config/`：监控对象、关键词、平台、阈值
- `prompts/`：分析型 Agent 的提示词模板
- `pipelines/`：将采集数据转换成可分析任务的流水线
- `reports/`：日报/周报模板与导出脚本

## 首批 Agent

1. `collector-agent`：调度采集任务并检查采集健康
2. `risk-agent`：对新事件做规则打分（敏感词、传播速度、影响力）
3. `briefing-agent`：生成中文摘要与处置建议
