# 任务包：SM1 Scout Media Governance Bootstrap

- 任务ID: SM1
- 日期: 2026-05-09
- 代码目录: `/Users/sourcefire/1data/scout-lab`
- 目标模块: `/Users/sourcefire/1data/scout-lab/scout-media-agents`
- 优先级: P0
- 状态: CHECK

## 背景
当前 `scout-media-agents` 已有回测与扩词基础，但还缺少可运营治理层。系统还不能稳定回答以下问题：
1. 当前有哪些 topic 正在追踪。
2. 哪些 seed 来自哪个 topic。
3. 哪些 expansion 已经审批通过。
4. 当前调度为什么跑某个 query。
5. 最近 crawl run 的结果与失败原因是什么。

## 目标
1. 建立第一版治理对象与文件型 registry。
2. 给运营者一个最小 CLI，可以审阅 topic/review/run 状态。
3. 固化文档结构，支持后续多 agent 并行开发。

## 范围
- In Scope:
  - `Topic / Seed / QueryUnit / CrawlRun` 的 TypeScript schema
  - registry/state 目录约定与读写
  - CLI 最小命令集
  - 文档与验收清单
- Out of Scope:
  - 真实数据库持久化
  - crawler 深度执行编排
  - export job 完整实现
  - dashboard 前端

## 交付物
1. `docs/Issue-Checks/*`
2. `scout-media-agents/src/*` 的治理 schema / registry / CLI 实现
3. `scout-media-agents/state/*` 的样例数据或初始化机制
4. smoke 测试与提交记录

## DoD
- [x] 文档骨架完成
- [x] governance schema 完成并可编译
- [x] CLI 命令可用
- [x] smoke 验证通过
- [ ] 本地与远程 git 同步完成
