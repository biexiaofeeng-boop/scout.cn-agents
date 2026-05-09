# Scout 统一验收清单

## 文档验收
- [ ] `docs/Issue-Checks` 具备根说明、backlog、checks、交接模板
- [ ] 当期月度目录具备 index、任务包、任务卡、实施顺序、agent 排班、设计稿
- [ ] 每个任务卡明确 scope、DoD、验证命令、回滚办法

## 代码验收
- [ ] `scout-media-agents` 已定义治理对象 schema：至少包含 `Topic / Seed / QueryUnit / CrawlRun`
- [ ] 存在最小 registry/state 文件读写层
- [ ] CLI 至少支持：`topics:list`、`review:list`、`review:approve`、`plan:next`、`runs:list`
- [ ] 既有 `backtest` 命令仍可用

## 验证命令
```bash
cd /Users/sourcefire/1data/scout-lab/scout-media-agents
npm run check
npm run cli -- help
npm run cli -- topics:list
npm run cli -- review:list
npm run cli -- plan:next --limit=5
npm run cli -- runs:list --limit=5
```

## 运行态联动检查
```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./docker-status.sh
curl -sS http://127.0.0.1:18080/health
curl -sS http://127.0.0.1:18080/runs?limit=5
```

## 运营检查项
- [ ] topic 至少有一条启用记录
- [ ] seed 可映射到 topic
- [ ] expansion 可标记 `pending/approved/rejected`
- [ ] query plan 可以解释“为什么现在跑这个词”
- [ ] run registry 可以回答“最近跑了什么、是否成功、产出多少”

## 发布门槛
- [ ] 文档完成
- [ ] TypeScript 编译通过
- [ ] CLI smoke 通过
- [ ] git 已本地提交并推送远程
