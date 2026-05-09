# 验收清单：SM1 Scout Media Governance Bootstrap

- 任务ID: SM1
- 验收日期: 2026-05-09
- 验收人: codex + sourcefire
- 状态: PASS

## 自动化检查
| 用例ID | 目标 | 命令 | 预期 |
|---|---|---|---|
| C01 | TypeScript 编译通过 | `npm run check` | 无错误退出 |
| C02 | CLI 帮助存在 | `npm run cli -- help` | 输出命令清单 |
| C03 | topic 列表可见 | `npm run cli -- topics:list` | 至少输出样例 topic |
| C04 | review 列表可见 | `npm run cli -- review:list` | 显示 pending/approved/rejected |
| C05 | review 批准有效 | `npm run cli -- review:approve <id>` | 状态变为 approved |
| C06 | plan 结果可见 | `npm run cli -- plan:next --limit=5` | 返回 query plan |
| C07 | runs 列表可见 | `npm run cli -- runs:list --limit=5` | 返回 run 记录 |
| C08 | backtest 仍兼容 | `npm run backtest -- --skip-llm` | 正常输出报告 |

## 手工检查
- [x] registry/state 目录结构符合设计稿
- [x] topic -> seed -> expansion/query -> run 的映射关系清晰
- [x] 文档中的 agent 排班与实施顺序可执行

## 风险检查
- [x] 未引入对运行中 crawler 的破坏性依赖
- [x] `.env`、密钥、vendor 数据未被提交
- [x] 新增 state 样例不包含敏感数据
