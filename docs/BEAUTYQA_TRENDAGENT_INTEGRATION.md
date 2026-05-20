# BeautyQA TrendAgent 集成建议

## 1. 结论

`BeautyQA-TrendAgent` 不应整体并入 `scout-lab` 运行时。

应拆成两类资产：

1. 可直接复用的产品化模式
2. 仅做领域参考的美妆专有实现

最值得集成到 `scout` 的，不是它的美妆业务模型，而是这些已经跑通的一方控制层能力：

- first-party `trend_signal` handoff
- expansion registry
- durable query schedule state
- runtime policy profile
- vendor crawler subprocess isolation
- runtime batch audit / export audit

## 2. 与 scout 现状对比

### scout 当前短板

- `scout-media-agents/` 目前只有 health probe
- `scout-ops/` 当前偏“增量入湖器”，不是完整采集编排器
- 缺少 seed / expansion / schedule / governance 的 durable first-party 状态

### BeautyQA 已经具备的能力

- FastAPI 控制面与清晰路由边界
- 关键词管理、任务管理、导出 API
- MediaCrawler 作为 vendor sidecar，而非业务代码本体
- 查询单元级别的调度状态与冷却时间
- first-party `trend_signal` 产物供下游 QA/RAG 消费

## 3. 模块映射

### 推荐保留并迁移到 scout 的部分

- `BeautyQA-TrendAgent/backend/app/domain/services/runtime_query_state_service.py`
- `BeautyQA-TrendAgent/backend/app/domain/services/runtime_policy_service.py`
- `BeautyQA-TrendAgent/backend/app/domain/services/trend_signal_export_service.py`
- `BeautyQA-TrendAgent/backend/app/domain/services/runtime_batch_service.py`
- `BeautyQA-TrendAgent/backend/app/infrastructure/crawler/adapter.py`
- `BeautyQA-TrendAgent/backend/app/infrastructure/crawler/process_manager.py`
- `BeautyQA-TrendAgent/backend/app/domain/services/task_service.py`
- `BeautyQA-TrendAgent/backend/app/domain/services/keyword_expansion_service.py`

### 只做参考，不建议原样并入 scout 的部分

- 美妆专有 prompt、keyword schema、trend taxonomy
- `BeautyQA-core/` 中的美妆 RAG 召回和回答策略
- 美妆领域 benchmark / eval 数据

### 可作为通用接口设计参考的部分

- `BeautyQA-core/src/trend_evidence/models.py`
- `BeautyQA-core/src/trend_evidence/pipeline.py`
- `BeautyQA-core/src/trend_evidence/agent_adapter.py`

## 4. 对 scout 的具体落点

### 4.1 `scout-media-agents`

把它从 probe 升级为真正的媒体编排层：

- `seed registry`
- `expansion registry`
- `query schedule states`
- `crawl task manager`
- `runtime policy profiles`
- `trend signal export`

建议新增子模块：

- `src/seeds/`
- `src/expansion/`
- `src/schedule/`
- `src/runtime/`
- `src/export/`
- `src/vendor/mediacrawler/`

### 4.2 `scout-ops`

继续保留统一入湖职责，但不再承担媒体平台的精细调度。

建议分工：

- `scout-media-agents`：负责 `seed -> expansion -> schedule -> crawl -> signal export`
- `scout-ops`：负责 `ingest -> dedup -> alert -> downstream event bus`

### 4.3 `agents/`

将 `BeautyQA-core` 的回答结构抽象成通用情报问答接口，而不是搬美妆逻辑：

- grounded lookup tool
- safety / risk / missing-info preservation
- fallback closure

## 5. 是否要改成 TypeScript

结论：要，但分层迁移。

### 应优先迁到 TypeScript 的部分

- 控制面 API
- registry / schedule state
- runtime policy
- task orchestration
- handoff/export contract

这些逻辑状态清晰、边界清晰，适合长期维护。

### 暂时不要优先迁的部分

- MediaCrawler vendor 本体
- QA-core 的评测脚本
- 特定领域 prompt 和实验流水线

这类逻辑要么受上游约束，要么偏研究性质，不是当前 `scout` 主线瓶颈。

## 6. 推荐集成方式

### 方式 A：最优先，低风险

只迁移设计，不迁移运行时：

1. 在 `scout-media-agents` 复刻 BeautyQA 的 first-party runtime model
2. 继续调用现有 `scout-vendor/mediacrawler/`
3. 产出通用 `trend_signal` / `intel_signal`
4. 交给 `scout-ops` 入湖

优点：

- 不引入第二套 Python 服务
- 不复制美妆领域包袱
- 最适合你当前中文情报主线

### 方式 B：中期过渡

保留 `BeautyQA-TrendAgent` 的 Python 后端为参考实现，同时在 `scout-media-agents` 做 TS 对等重建。

适用场景：

- 你想边迁移边对照回测
- 你要快速验证 `registry / schedule / export` 行为

### 方式 C：不推荐

把 `BeautyQA-TrendAgent` 整个直接 vendoring 到 `scout-lab`

问题：

- 会引入第二套 Python control plane
- 数据库、Redis、Celery、API 都重复
- 领域命名和 schema 不通用

## 7. 首批建议迁移的能力

第一批只迁五项：

1. `query_unit_key` 模型
2. `expansion registry`
3. `query schedule state`
4. `runtime policy profile`
5. `trend_signal` current/history handoff export

不要第一批就迁：

- Celery
- 美妆 prompt
- QA benchmark
- 复杂评测链路

## 8. 目标形态

最终建议形态：

1. `scout-media-agents` 成为通用中文趋势采集编排层
2. `scout-vendor/mediacrawler/` 仍然是 vendor crawler engine
3. `scout-ops` 继续做统一入湖与告警
4. `agents/` 基于统一 signal / event 做分析问答
5. 领域项目如 BeautyQA 只消费 `scout` 产出的通用 signal，而不再自带独立采集控制面

## 9. 下一步

建议下一步直接做：

1. 在 `scout-media-agents` 建第一版 TypeScript `query schedule state` 和 `expansion registry`
2. 定义通用 `intel_signal` / `trend_signal` schema
3. 用现有 `scout-vendor/mediacrawler/` 接一个最小可运行的 `seed -> schedule -> export` 闭环
