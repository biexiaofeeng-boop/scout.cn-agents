# 中文情报 Agents 体系蓝图

## 1. 体系目标

构建一个可持续运营的中文世界情报助手系统，支持：

- 多平台情报连续采集
- 实体识别与主题聚类
- 风险事件自动告警
- 人工复核与知识沉淀

## 2. 分层架构

### A. 数据接入层（Ingestion Agents）

- `agent.mcrawler`：消费 `MediaCrawler` 数据源
- `agent.wechat`：消费 `wechat-spider` 数据源
- 统一通过 `intel_hub` 写入标准事件表 `intel_events`

### B. 数据标准化层（Normalization Agents）

- 去重（已基于 `record_hash`）
- 字段标准化（平台、时间、账号、内容类型）
- 富化（关键词、情感、实体、地区）

### C. 分析决策层（Analysis Agents）

- `agent.topic`：主题发现与趋势变化
- `agent.risk`：敏感事件与舆情异常检测
- `agent.watchlist`：重点账号/关键词监控

### D. 执行协同层（Action Agents）

- 告警路由（Webhook/企业微信/邮件）
- 工单触发（人工核查）
- 处置建议生成（模板化输出）

## 3. 核心数据流

1. 采集器产生原始数据（MediaCrawler、wechat-spider）
2. `intel_hub` 增量拉取并写入统一事件表
3. 分析 Agents 读取标准事件表与聚合视图
4. 产出告警、日报、专题报告
5. 结果反哺规则库（关键词、规则、白名单/黑名单）

## 4. 工程化基线

- 运行脚本：`ops/scan.sh`, `ops/start.sh`, `ops/status.sh`, `ops/stop.sh`
- 健康检查：`/api/health`, `/health`, `/alerts`
- 异常缓冲：DLQ (`intel_hub/state/dlq.jsonl`)
- 安全要求：API Key 鉴权、内网监听、最小暴露端口

## 5. 三阶段迭代（建议）

## 阶段一：可运营（1-2 周）

- 打通数据链路并稳定运行
- 固化告警阈值与值班流程
- 输出每日运行报告（采集量、失败量、DLQ）

## 阶段二：可分析（2-4 周）

- 增加主题聚类、实体提取、情感判定
- 构建重点对象 watchlist
- 建立风险评分模型（规则优先）

## 阶段三：可决策（4-8 周）

- 自动化事件归因与优先级排序
- 告警自动分发到责任人
- 建立“事件 -> 处置 -> 复盘”的闭环指标

## 6. 立刻可执行的下一步

1. 安装 Docker 后通过 `ops/scan.sh` 达到 `FAIL=0`
2. 启动全链路并连续运行 24h 观察失败模式
3. 新建 `watchlist` 配置（重点关键词、账号、事件类型）
4. 增加第一版日报生成任务（按小时聚合）
