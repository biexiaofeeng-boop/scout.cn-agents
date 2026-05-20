# Scout Lab Operations Runbook

## 1. 当前系统形态（2026-05 更新）

Scout Lab 由两套独立的采集体系组成。它们不竞争，分工服务不同
垂类。运营员（含本团队所有上手成员）的日常入口是 **scout-ops 的
Ops Console**：`http://127.0.0.1:18080/ops`。

### 1.1 Ops Console 直接驱动的渠道

公开 API 渠道，scout-ops 同步执行：

- **Steam**（store search + reviews）— 无需 key
- **YouTube**（Data API v3）— 需要 `YOUTUBE_API_KEY`
- **Reddit**（公开 JSON search）— 无需 key

这三个走 `scout-vendor/` 下的 connectors，由 `OpsActionService`
通过子进程同步调用。所有运行都进 Ops Console 的 run history +
review queue。

### 1.2 外部驱动、共享数据的渠道

CN 平台与公众号，由各自独立服务运行，scout-ops 当前只能**监控
存活 + 复用产物**，不主动启动爬虫：

- **MediaCrawler**（小红书 / 抖音 / B 站 / 微博 / 知乎 / 贴吧 /
  快手）— FastAPI 服务，监听 `:18081`。需手动启动且首次需登录。
- **WeChat Spider**（公众号文章 + 评论）— docker stack 长驻服务，
  数据落 MariaDB。

这两条线的实际数据采集质量更高、跨度更长，是 lab 项目里**实战
验证过的**。但因为登录态与限流策略复杂，目前不在 Ops Console 的
直接执行范围内；只在 Provider 页的 Test 按钮里做存活探测。

### 1.3 数据流

```
+-- Ops Console (scout-ops) ---+    +-- MediaCrawler API --+
| 5 tabs · schedules · review  |    | :18081 webui+API     |
+---------------+--------------+    +-----------+----------+
                |                               |
                v                               v
        scout-vendor connectors         data/<platform>/jsonl/
        (steam/youtube/reddit)
                |                               |
                v                               v
        runtime/<project>/topics/      (operator-driven, separate)
        <topic-id>/raw/<provider>/*.jsonl
                |
                v
        normalize → evidence.jsonl + handoff/evidence.json
                |
                v
        review-queue/*.json  ──→  approved
                                       |
                                       v
                                  downstream (GameLens etc.)
```

---

## 2. 日常运营入口（操作员用）

### 2.1 启动方式

**生产推荐**：docker compose（自动拉 env、scheduler 常驻）

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
docker compose up -d
```

容器状态：

| 容器 | 端口 | 作用 |
|---|---|---|
| `scout-stack-scout-ops-api-1` | :18080 | Ops Console + 所有 API |
| `scout-stack-scout-ops-scheduler-1` | — | 60s tick 驱动定时 schedule |
| `scout-stack-mariadb-1` | :3306 | WeChat 数据 |
| `scout-stack-redis-1` | :6379 | WeChat 任务队列 |
| `scout-stack-wechat-spider-1` | :8080/:8081 | 公众号爬虫 |

更新代码到容器：

```bash
docker compose build scout-ops-api scout-ops-scheduler
docker compose up -d scout-ops-api scout-ops-scheduler
```

**本地开发**：直接跑 tsx（自动读取 scout-deploy/env/scout-ops.env）

```bash
cd scout-ops
npm install   # 仅首次
npx tsx src/cli.ts api --port 18090
```

### 2.2 Ops Console 5 个 Tab

进入 `http://127.0.0.1:18080/ops` 默认是 Dashboard。

| Tab | URL | 用途 |
|---|---|---|
| **Dashboard** | `/ops/dashboard` | 工作起点：待审 / 失败 schedule / 缺 env provider 一屏概览 |
| **Topics** | `/ops/topics` | 按 vertical/project/搜索筛选 topic；点行进详情页 |
| **Topic Detail** | `/ops/topics/:topicId` | 该 topic 的 Channels / Schedules / Runs / Reviews / Artifacts；右上 Run Now drawer |
| **Collection** | `/ops/collection` | 新任务表单（Mode = Run now / Dry run / Schedule）；下方 sub-tab 切 Recent Runs 与 Schedules |
| **Review & Handoff** | `/ops/review` | pending review queue + 抽屉式 preview + handoff 文件总览 |
| **System** | `/ops/system` | Providers 状态 + Test 按钮 + Alerts |

### 2.3 典型工作流

**A. 触发一次性采集**：

1. Dashboard 看是否有 pending review 阻塞
2. Topics → 选项目（vertical/project filter） → 点 topic 行
3. Topic Detail → 右上 **Run Now** → drawer 内勾 channels → 提交
4. drawer 关，当前 tab 5s 自动 refresh 显示新 run
5. 跑完进 Review tab → 点 Preview drawer → Approve / Reject

**B. 设置定时任务**：

1. Collection tab → New Run 表单 → Mode = **Schedule recurring**
2. 选 Topic + Channels；Frequency = Daily 09:07 / Weekly Mon / Hourly / Every N hours
3. 点 Save schedule
4. 下方 Schedules sub-tab 看到新行；点行进 schedule drawer 可 Pause / Resume / Run Now / Delete

**C. 定时跑出来后审阅**：

1. Dashboard "Needs Attention" 直接列 pending review
2. 点 → 跳 Review tab → Preview drawer 看 normalized sample + handoff JSON
3. drawer 内 Approve / Reject → 自动 refresh

**D. 跑失败排查**：

1. Recent Runs 表 → status filter "failed" → 整行点开 drawer
2. drawer 显示 Phase（从 logs 推断）+ Commands 表 + 错误归类 pill（rate_limit / auth / upstream / missing_env / timeout / network）
3. drawer 内 Retry 按钮，或跳 Full Page 看 commandResults / logs 末尾 30 行

### 2.4 健康检查

| 命令 | 期待 |
|---|---|
| `curl http://127.0.0.1:18080/health` | `{"status":"ok"...}` |
| `curl http://127.0.0.1:18080/alerts` | `{"alerts":[]}` 或告警列表 |
| Ops Console → System tab → Test 每个 provider | 三家 ready，mediacrawler/wechat 看下面 2.5 |

### 2.5 MediaCrawler 启动（按需）

scout-ops 不会自动启动 mediacrawler。需要时手工：

```bash
cd /Users/sourcefire/1data/scout-lab/scout-vendor/mediacrawler
source .venv/bin/activate
python -m api.main   # 或参考 mediacrawler/README.md
```

启动后 System tab 的 mediacrawler Test 按钮应返回 `ok`。

WeChat Spider 由 docker compose 自动管理，正常情况下不需要手动启动。

---

## 3. 关键配置

### 3.1 env 来源（按优先级）

scout-ops 启动时按以下顺序加载 env，**前面的优先**：

1. `SCOUT_ENV_FILE` 环境变量指定的文件
2. `scout-ops/.env`（本地开发者覆盖）
3. `scout-deploy/env/scout-ops.env`（docker / 团队共享）

意味着：日常修改 prod 配置改 `scout-deploy/env/scout-ops.env`，
临时本地实验放 `scout-ops/.env`，特殊情况用 `SCOUT_ENV_FILE`。

### 3.2 关键变量

| 变量 | 默认 | 何时改 |
|---|---|---|
| `SCOUT_RUNTIME_ROOT` | `<projectRoot>/../scout` | 运行时数据目录 |
| `SCOUT_PIPELINE_TICK_ENABLED` | `false` | 启用旧 wechat/mediacrawler pipeline tick（已冻结，一般不用开） |
| `SCOUT_OPS_SHOW_PIPELINE_VIEWS` | `false` | 在 `/ops/system` 显示 Hub Health / Recent Hub Runs |
| `SCOUT_OPS_ACTION_TIMEOUT_MS` | `180000` | 单次子进程超时 |
| `SCOUT_OPS_RUN_RETENTION_DAYS` | `30` | run 目录保留天数 |
| `SCOUT_OPS_RUN_RETENTION_MAX` | `300` | run 目录保留条数 |
| `YOUTUBE_API_KEY` | — | YouTube Data API 必需 |
| `MEDIACRAWLER_API_URL` | `http://127.0.0.1:18081` | mediacrawler 健康检查目标。docker 容器内应改为 `http://host.docker.internal:18081`（mediacrawler 跑在宿主机时） |
| `WECHAT_SPIDER_URL` | `http://127.0.0.1:8080` | 仅文档用。wechat-spider 是 mitmproxy 代理，无 HTTP 健康检查；docker 内可设 `http://wechat-spider:8080` |
| `WECHAT_MYSQL_PASSWD` | — | docker 内 mariadb 密码 |

### 3.3 关键目录

```
scout-lab/                                  ← 代码 + 配置（git 内）
├── scout-ops/                              ← TS 控制平面
├── scout-vendor/                           ← 公开 API connectors + mediacrawler 镜像
├── scout-media-agents/config/topics/       ← scout-topics.json
├── scout-media-agents/config/trend-seeds.csv
├── scout-deploy/                           ← docker compose + env files
└── ...

scout/                                       ← 运行时（git 外，定期备份）
├── runs/scout_run_*/                       ← 每次 run 的 summary + logs + items
├── topics/<vertical>/<topicId>/            ← raw / normalized / handoff
├── review-queue/review_scout_run_*.json    ← 审阅记录
└── schedules/schedule_*.json               ← 定时配置
```

---

## 4. 排错指南

### 4.1 Topic 全部 channel 不可用

UI 表现：Collection tab 选某 topic 后所有 channel checkbox 灰掉，
Run 按钮禁用 + 红字提示 "runs as an external service"。

含义：该 topic 用的是 mediacrawler / wechat-spider，scout-ops 不
直接驱动。去 mediacrawler webui 或 wechat-spider 服务自己跑。

### 4.2 YouTube 显示 "missing env"

`scout-deploy/env/scout-ops.env` 应该有 `YOUTUBE_API_KEY=...`。
如果是本地 tsx 启动，检查启动目录是不是 `scout-ops/`（env 文件
查找路径相对于 cwd）。

### 4.2.1 Provider Test 按钮：mediacrawler 显示 network / service_down

scout-ops-api 在 docker 容器内 fetch `127.0.0.1` 指向容器自己，
不是宿主机。如果 mediacrawler 跑在宿主机，必须在 `scout-deploy/env/scout-ops.env`
里加：

```
MEDIACRAWLER_API_URL=http://host.docker.internal:18081
```

然后 `docker compose up -d scout-ops-api` 重启容器加载新 env。
本地直跑 tsx 时则默认 `127.0.0.1:18081` 即可。

wechat-spider 没有 Test 按钮，因为它是 mitmproxy 代理不响应 HTTP。
状态用 `docker compose ps scout-stack-wechat-spider-1` 看。

### 4.3 Schedule 设了但不跑

确认 scheduler 容器在跑：

```bash
docker logs --tail 20 scout-stack-scout-ops-scheduler-1
```

应该看到 `{"event":"scheduler_pipeline_tick_disabled"}`（一次）
+ 每分钟一次的 schedules_triggered 或安静。如果容器挂了，
`docker compose up -d scout-ops-scheduler`。

### 4.4 Cleanup Runs 删了在跑的 run

不会。`cleanupRuns` 已经在 status="running" 检查里跳过运行中的
run（fix: opsActionService cleanupRuns 加 status check）。如果
看到此现象，提 issue 并附 run.json 内容。

### 4.5 Ops Console 显示但操作 405/404

`/ops/runs/:runId/view` / `/ops/review-queue/:id/preview` 这些
是 scout-ops 内置 HTML 路由。404 时多半是 runId / reviewId 拼写
错误（注意 ID 必须以 `scout_run_` / `review_scout_run_` 开头）。

---

## 5. 备份与回滚

### 5.1 运行时数据备份（手动）

```bash
rsync -av /Users/sourcefire/1data/scout/ /Users/sourcefire/backups/scout-$(date +%Y%m%d)/
```

关键目录：`schedules/`、`review-queue/`、`topics/*/handoff/`。
（监控告警 / 自动备份 / 权限隔离，暂由运营员手动管理，待业务稳定后再投入。）

### 5.2 代码回滚

```bash
cd /Users/sourcefire/1data/scout-lab
git log --oneline -10                                # 找上一个稳定 commit
git checkout <commit-sha> -- scout-ops/              # 回滚 scout-ops
cd scout-deploy && docker compose build && docker compose up -d
```

---

## 6. 历史路径（已冻结，仅供参考）

`intel_hub/` 已删除——它的"unified ingestion for MediaCrawler + wechat-spider"
定位与 scout-ops 完全重叠，scout-ops 已经在事实上取代了它的全部职责
（pipeline / scheduler / monitor / retry / DLQ）。如果需要历史代码，
看 git 历史 commit 之前的版本。

`scout-ops-scheduler` 容器默认禁用旧 pipeline tick
（`SCOUT_PIPELINE_TICK_ENABLED=false`），避免去消费已经无主的
pipeline 数据。

## 7. Git 边界与目录契约

scout-lab 和 `scout/`（运行时目录）有明确的边界，**不要尝试统一**：

| 目录 | 角色 | git 状态 |
|---|---|---|
| `scout-lab/` | 源代码 + 配置（topic 定义 / seed 关键词 / docker / env） | ✓ git 管理（origin: github） |
| `scout/`（即 `$SCOUT_RUNTIME_ROOT`） | 运行时输出（runs / reviews / schedules / handoff） | ✗ **不 git** |

约定通过 `SCOUT_RUNTIME_ROOT` env 变量连接，默认值
`<projectRoot>/../scout`，docker 内通过 `scout-deploy/docker-compose.yml`
的 volume mount 提供。

`scout/README.md` 详细说明了运行时目录的子结构和备份建议。
**新加入团队的成员**：clone scout-lab 后，env 一配，运行时目录会
自动产生，不需要任何 scout/ 初始化步骤。

如果有"需要 git 管理的初始化数据"，正确的位置是 `scout-lab/scout-media-agents/config/`
（例如把 topic 定义、seed 关键词配置写到那里），而不是 `scout/`。

---

## 8. 接收新项目（任务包工作流）

项目方（game / finance 等）**不直接编辑 scout-lab**。他们把
"任务包"（YAML）丢到 `scout/inbox/projects/<projectId>/task-packs/`，
运营员在 scout-ops 用 CLI 校验 + 预览 + 合入 config。

### 8.1 项目方提交任务包

```
scout/inbox/projects/finance/task-packs/2026-05-19-bootstrap.yaml
```

最小 schema（完整字段见 `scout/inbox/README.md`）：

```yaml
projectId: finance         # 必须匹配父文件夹名
intent: "为什么提这个包"

topics:
  - id: fin-us-ai-equity
    name: "US AI equity narratives"
    vertical: finance
    dataSources: [reddit, youtube]
    seedKeywordIds: [FIN-001]

seeds:
  - keywordId: FIN-001
    keyword: "AI equity"
    queryVariants: [NVDA, "Palantir AI", "AI stock thesis"]
```

### 8.2 运营员处理（在 scout-ops 目录）

```bash
# 列出所有待 sync 任务包
npx tsx src/cli.ts inbox status

# 看一个 pack 会引入什么 diff（不写入）
npx tsx src/cli.ts inbox preview projects/finance/task-packs/2026-05-19-bootstrap.yaml

# 真正合并（写入 scout-topics.json + trend-seeds.csv，归档原文件到 _synced/）
npx tsx src/cli.ts inbox sync projects/finance/task-packs/2026-05-19-bootstrap.yaml

# 看 git diff，确认无误后人工 commit + push
cd /Users/sourcefire/1data/scout-lab
git diff scout-media-agents/config/
git add scout-media-agents/config/
git commit -m "feat(finance): bootstrap topics from task pack 2026-05-19"
```

**inbox sync 不自动 git commit**——这是有意的安全设计。运营员
应该 review 后人工 commit，避免错误任务包污染主线。

### 8.3 接入新项目的 onboarding 流程

1. 运营员在 `scout/inbox/projects/<新-projectId>/` 创建目录
2. 写一份 `README.md` 说明项目方信息（可选）
3. 把 yaml 通过群里 / 邮件 / 协作工具发给项目方，让他们填好回传
4. 收到后放到 `task-packs/`，运行 `inbox preview`、`inbox sync`
5. 后续新需求由项目方直接放新 yaml，运营员定期 batch sync
