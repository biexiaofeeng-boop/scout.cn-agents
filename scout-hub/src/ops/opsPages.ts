import type { OpsArtifactState, OpsOverview, OpsReviewItem } from "./types.js";

export function renderOpsPage(overview: OpsOverview, options: { initialTab?: string } = {}): string {
  const initialTab = options.initialTab || "dashboard";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scout Ops Console</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Scout Intelligence Agents</p>
        <h1>Ops Console</h1>
        <p class="lede">Topic governance, scheduled collection, and reviewed handoff for game-material intelligence.</p>
      </div>
      <div class="hero-actions">
        <a class="pill" href="/ops/overview.json">Open JSON</a>
      </div>
    </section>

    ${renderTabNav(initialTab)}

    <section class="tab-body${initialTab === "dashboard" ? "" : " hidden"}" data-tab-body="dashboard">
      ${renderDashboard(overview)}
    </section>

    <section class="tab-body${initialTab === "topics" ? "" : " hidden"}" data-tab-body="topics">
      <section class="panel">
        <div class="panel-head"><h2>Topics</h2><span>${overview.summary.activeTopicCount} active of ${overview.topics.length}</span></div>
        ${renderTopics(overview)}
      </section>
    </section>

    <section class="tab-body${initialTab === "collection" ? "" : " hidden"}" data-tab-body="collection">
      <section class="panel">
        <div class="panel-head"><h2>New Run</h2><span>SO2 guarded execution</span></div>
        ${renderOpsActions(overview)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Active Schedules</h2><span>${overview.schedules.length} total, ${overview.summary.activeScheduleCount} active</span></div>
        ${renderSchedules(overview)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Recent Runs</h2><span>${overview.recentOpsRuns.length} rows</span></div>
        ${renderOpsRuns(overview)}
        <div id="ops-cleanup-result" class="empty" style="margin-top:12px">Cleanup and retry results appear here.</div>
      </section>
    </section>

    <section class="tab-body${initialTab === "review" ? "" : " hidden"}" data-tab-body="review">
      <section class="panel">
        <div class="panel-head"><h2>Review Queue</h2><span>${overview.summary.pendingReviewCount} pending</span></div>
        ${renderReviewQueue(overview)}
        <div id="ops-review-result" class="empty" style="margin-top:12px">Approve / reject results appear here.</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Handoff Files</h2><span>per topic</span></div>
        ${renderHandoffFiles(overview)}
      </section>
    </section>

    <section class="tab-body${initialTab === "system" ? "" : " hidden"}" data-tab-body="system">
      <section class="panel">
        <div class="panel-head"><h2>Providers</h2><span>Secrets are never rendered</span></div>
        ${renderProviders(overview)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Alerts</h2><span>${overview.alerts.length} active</span></div>
        ${renderAlerts(overview)}
      </section>
      ${overview.showPipelineViews ? `<section class="panel">
        <div class="panel-head"><h2>Hub Health</h2><span>${h(overview.generatedAt)}</span></div>
        ${renderHealth(overview)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Recent Hub Runs</h2><span>${overview.recentRuns.length} rows</span></div>
        ${renderRuns(overview)}
      </section>` : ""}
      <section class="panel">
        <div class="panel-head"><h2>Operator Notes</h2><span>Background</span></div>
        <details>
          <summary>Show notes</summary>
          <ul class="notes" style="margin-top:12px">
            <li>Topic governance: only allowlisted providers and known topics. No arbitrary shell command input.</li>
            <li>Schedules drive timed batch via the Ops Action flow; every run lands in the Review Queue before downstream consumption.</li>
            <li>Runtime artifacts live outside git under the configured Scout runtime root.</li>
            <li>YouTube live collection requires <code>YOUTUBE_API_KEY</code>; dry-run is available without one.</li>
          </ul>
        </details>
      </section>
    </section>
  </main>
  <aside id="review-drawer" class="review-drawer hidden" aria-hidden="true">
    <div class="drawer-overlay" data-drawer-close></div>
    <div class="drawer-panel">
      <header class="drawer-head">
        <h3 id="drawer-title">Review Preview</h3>
        <button type="button" data-drawer-close class="pill secondary">Close</button>
      </header>
      <div id="drawer-body" class="drawer-body"></div>
      <footer id="drawer-actions" class="drawer-actions"></footer>
    </div>
  </aside>
  <script>${clientScript()}</script>
</body>
</html>`;
}

function renderHealth(overview: OpsOverview): string {
  const health = overview.hubHealth as { dlqSize?: number; alert?: boolean; metrics?: Record<string, unknown>; stateDir?: string };
  const metrics = health.metrics || {};
  return `<table class="kv">
    ${kv("stateDir", health.stateDir || "")}
    ${kv("dlqSize", String(health.dlqSize ?? 0))}
    ${kv("alert", String(health.alert ?? false))}
    ${kv("runsTotal", String(metrics.runsTotal ?? 0))}
    ${kv("runsFailed", String(metrics.runsFailed ?? 0))}
    ${kv("eventsInserted", String(metrics.eventsInserted ?? 0))}
    ${kv("lastRunAt", String(metrics.lastRunAt ?? ""))}
  </table>`;
}

function renderAlerts(overview: OpsOverview): string {
  if (overview.alerts.length === 0) return `<div class="empty ok">No active alerts.</div>`;
  return `<div class="stack">${overview.alerts.map((alert) => `<div class="alert ${h(alert.level)}"><b>${h(alert.code)}</b><span>${h(alert.message)}</span></div>`).join("")}</div>`;
}

function renderProviders(overview: OpsOverview): string {
  const testable = new Set(["steam", "reddit", "youtube"]);
  return `<table>
    <thead><tr><th>Provider</th><th>Status</th><th>Purpose</th><th>Verticals</th><th>Test</th></tr></thead>
    <tbody>
      ${overview.providers.map((provider) => {
        const ready = provider.envState !== "missing" && provider.status !== "planned";
        const canTest = testable.has(provider.id);
        return `<tr>
        <td><b>${h(provider.label)}</b><div class="mono">${h(provider.id)}</div></td>
        <td>${ready ? `<span class="icon ok">ready</span>` : `<span class="icon warn">${h(provider.envState === "missing" ? "not ready · missing env" : provider.status)}</span>`}</td>
        <td>${h(provider.notes)}</td>
        <td>${provider.verticals.map(tag).join("")}</td>
        <td>${canTest ? `<button type="button" data-provider-test="${h(provider.id)}" class="secondary">Test</button><span class="muted provider-test-result" data-provider-test-result="${h(provider.id)}"></span>` : `<span class="muted">—</span>`}</td>
      </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

function renderOpsActions(overview: OpsOverview): string {
  const collectable = new Set(["steam", "youtube", "reddit"]);
  const activeTopics = overview.topics.filter((topic) => topic.status === "active");
  const providers = overview.providers.filter((provider) => collectable.has(provider.id));
  const initialTopic = activeTopics[0];
  return `<div class="ops-actions">
    <form id="ops-run-form" data-prev-query="${h(initialTopic?.name || "")}">
      <div class="form-row">
        <label>Mode
          <select name="mode">
            <option value="oneshot" selected>One-shot (run now)</option>
            <option value="recurring">Recurring (schedule)</option>
          </select>
        </label>
        <label>Action
          <select name="action">
            <option value="collect-and-normalize-topic" selected>collect-and-normalize</option>
            <option value="collect-topic">collect</option>
            <option value="normalize-topic">normalize</option>
          </select>
        </label>
        <label>Topic
          <select name="topicId">
            ${activeTopics.map((topic) => `<option value="${h(topic.id)}" data-query="${h(topic.name)}" data-project="${h(topic.projectId)}" data-sources='${h(JSON.stringify(topic.dataSources))}'>${h(topic.name)} / ${h(topic.id)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="provider-checks">
        ${providers.map((provider) => {
          const missing = provider.envState === "missing";
          const disabled = missing ? "disabled" : "";
          const initialChecked = !missing && (initialTopic?.dataSources.includes(provider.id) ?? false);
          return `<label class="check ${missing ? "disabled" : ""}">
            <input type="checkbox" name="providers" value="${h(provider.id)}" ${initialChecked ? "checked" : ""} ${disabled} />
            <span>${h(provider.id)}</span>
            ${missing ? `<small>missing env</small>` : ""}
          </label>`;
        }).join("")}
      </div>
      <div class="form-row">
        <label>Query (optional)
          <input name="query" value="${h(initialTopic?.name || "")}" placeholder="defaults to topic name" />
        </label>
        <label>Limit
          <input name="limit" type="number" min="1" max="25" value="10" />
          <small class="muted">max 25 per run</small>
        </label>
      </div>
      <div class="form-row" data-mode-block="recurring" style="display:none">
        <label>Frequency
          <select name="frequency">
            <option value="daily" selected>Daily</option>
            <option value="weekly">Weekly</option>
            <option value="hourly">Hourly</option>
            <option value="every_n_hours">Every N hours</option>
          </select>
        </label>
        <label>Time (HH:MM)
          <input type="time" name="time" value="09:07" />
        </label>
        <label data-freq-show="weekly" style="display:none">Weekday
          <select name="weekday">
            <option value="0">Sun</option>
            <option value="1" selected>Mon</option>
            <option value="2">Tue</option>
            <option value="3">Wed</option>
            <option value="4">Thu</option>
            <option value="5">Fri</option>
            <option value="6">Sat</option>
          </select>
        </label>
        <label data-freq-show="every_n_hours" style="display:none">Every N hours
          <input type="number" name="everyNHours" value="6" min="1" max="24" />
        </label>
        <label>Timezone
          <input name="timezone" value="Asia/Shanghai" />
        </label>
      </div>
      <div class="form-row" data-mode-block="oneshot">
        <label>Steam appId
          <input name="appId" placeholder="optional, for app reviews" />
        </label>
        <label>Subreddit
          <input name="subreddit" placeholder="optional, e.g. gamedev" />
        </label>
        <label>GameLens gameIds
          <input name="gameIds" placeholder="optional comma list" />
        </label>
      </div>
      <div class="form-row">
        <label class="check"><input type="checkbox" name="dryRun" /> <span>dry-run</span></label>
        <label class="check" data-mode-block="oneshot"><input type="checkbox" name="includeDryRun" /> <span>include dry-run in normalize</span></label>
      </div>
      <div class="hero-actions inline">
        <button type="button" data-run-mode="oneshot">Run Now</button>
        <button type="button" data-run-mode="recurring" style="display:none">Save Schedule</button>
      </div>
    </form>
    <div id="ops-action-result" class="empty">Pick mode + topic, then run or save as a schedule. Results persist under ${h(overview.runtimeRoot)}/runs.</div>
  </div>`;
}

function renderReviewQueue(overview: OpsOverview): string {
  if (overview.reviewQueue.length === 0) return `<div class="empty">No review items yet. Run Normalize or Collect + Normalize to create review gates.</div>`;
  const pending = overview.reviewQueue.filter((item) => item.status === "pending");
  const decided = overview.reviewQueue.filter((item) => item.status !== "pending");
  const renderRow = (item: OpsReviewItem) => `<tr>
      <td><b>${h(shortenId(item.id))}</b><div class="muted" title="${h(item.id)}">${h(relativeTime(item.createdAt))}</div></td>
      <td>${tag(item.status)}${item.reviewer ? `<div class="muted">by ${h(item.reviewer)}</div>` : ""}</td>
      <td><div class="mono">${h(item.topicId)}</div>${item.projectId ? tag(item.projectId) : ""}<div>${item.providers.map(tag).join("")}</div></td>
      <td>${item.rawRecordCount} raw / ${item.normalizedEvidenceCount} ev${item.dryRun ? `<div>${tag("dry-run")}</div>` : ""}</td>
      <td>
        <span class="icon ${item.reportPath ? "ok" : "off"}" title="report: ${h(item.reportPath || "missing")}">${item.reportPath ? "✓" : "✗"} rpt</span>
        <span class="icon ${item.handoffPath ? "ok" : "off"}" title="handoff: ${h(item.handoffPath || "missing")}">${item.handoffPath ? "✓" : "✗"} hdf</span>
      </td>
      <td>
        <div class="hero-actions inline">
          <a href="/ops/review-queue/${h(item.id)}/preview" class="pill">Preview</a>
          ${item.status === "pending" ? `<button type="button" data-review="${h(item.id)}" data-status="approved">Approve</button>
          <button type="button" data-review="${h(item.id)}" data-status="rejected" class="secondary">Reject</button>` : `<span class="muted">${h(item.decisionNote || "decided")}</span>`}
        </div>
      </td>
    </tr>`;
  const pendingBlock = pending.length === 0
    ? `<div class="empty ok">No pending reviews. Decided items below.</div>`
    : `<table>
      <thead><tr><th>Review</th><th>Status</th><th>Topic</th><th>Evidence</th><th>Artifacts</th><th>Decision</th></tr></thead>
      <tbody>${pending.map(renderRow).join("")}</tbody>
    </table>`;
  const decidedBlock = decided.length === 0 ? "" : `<details style="margin-top:14px">
    <summary>Show ${decided.length} decided items</summary>
    <table style="margin-top:10px">
      <thead><tr><th>Review</th><th>Status</th><th>Topic</th><th>Evidence</th><th>Artifacts</th><th>Decision</th></tr></thead>
      <tbody>${decided.map(renderRow).join("")}</tbody>
    </table>
  </details>`;
  return pendingBlock + decidedBlock;
}

function renderTopics(overview: OpsOverview): string {
  if (overview.topics.length === 0) return `<div class="empty warn">No topics loaded. Check topic config path: ${h(overview.topicConfigPath)}</div>`;
  const verticals = [...new Set(overview.topics.map((t) => t.vertical).filter(Boolean))].sort();
  const projects = [...new Set(overview.topics.map((t) => t.projectId).filter(Boolean))].sort();
  const statuses = [...new Set(overview.topics.map((t) => t.status).filter(Boolean))].sort();
  const filterBar = `<div class="hero-actions inline" style="margin-bottom:14px">
    <select data-topics-filter="vertical" class="runs-filter">
      <option value="">all verticals</option>
      ${verticals.map((v) => `<option value="${h(v)}">${h(v)}</option>`).join("")}
    </select>
    <select data-topics-filter="projectId" class="runs-filter">
      <option value="">all projects</option>
      ${projects.map((p) => `<option value="${h(p)}">${h(p)}</option>`).join("")}
      <option value="__none__">(no project)</option>
    </select>
    <select data-topics-filter="status" class="runs-filter">
      ${statuses.map((s) => `<option value="${h(s)}"${s === "active" ? " selected" : ""}>${h(s)}</option>`).join("")}
      <option value="">all status</option>
    </select>
    <input type="search" data-topics-filter="search" class="runs-filter" placeholder="search name or id" style="min-width:200px" />
    <span class="muted" data-topics-count style="align-self:center">— of ${overview.topics.length}</span>
  </div>`;
  return `${filterBar}<table>
    <thead><tr><th>Topic</th><th>Last Run</th><th>Pending</th><th>Next Schedule</th><th>Channels</th></tr></thead>
    <tbody>
      ${overview.topics.map((topic) => {
        const lastRun = overview.recentOpsRuns.find((r) => r.topicId === topic.id);
        const activeSchedules = overview.schedules.filter((s) => s.topicId === topic.id && s.status === "active");
        const nextSchedule = activeSchedules.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0];
        const pendingReviews = overview.reviewQueue.filter((r) => r.topicId === topic.id && r.status === "pending");
        const channelHealth = topic.dataSources.map((src) => {
          const provider = overview.providers.find((p) => p.id === src);
          if (!provider) return { id: src, ok: false, reason: "unknown" };
          if (provider.envState === "missing") return { id: src, ok: false, reason: "missing-env" };
          return { id: src, ok: true, reason: "" };
        });
        const okCount = channelHealth.filter((c) => c.ok).length;
        const channelSummary = channelHealth.map((c) => `<span class="icon ${c.ok ? "ok" : "warn"}" title="${h(c.reason || "ready")}">${c.ok ? "✓" : "✗"} ${h(c.id)}</span>`).join("");
        const projectKey = topic.projectId || "__none__";
        const searchHaystack = `${topic.id} ${topic.name} ${topic.description}`.toLowerCase();
        return `<tr class="clickable" data-topic-drawer="${h(topic.id)}" data-topic-vertical="${h(topic.vertical || "")}" data-topic-projectid="${h(projectKey)}" data-topic-status="${h(topic.status || "")}" data-topic-search="${h(searchHaystack)}">
          <td>
            <b>${h(topic.name)}</b>
            <div class="muted">${tag(topic.status)}${tag(topic.priority)}${topic.projectId ? tag(topic.projectId) : ""}<span class="mono">${h(topic.id)}</span></div>
          </td>
          <td>${lastRun ? `${tag(lastRun.status)}<div class="muted" title="${h(lastRun.endedAt || lastRun.startedAt)}">${h(relativeTime(lastRun.endedAt || lastRun.startedAt))}</div>` : `<span class="muted">never</span>`}</td>
          <td>${pendingReviews.length > 0 ? `<span class="icon warn">${pendingReviews.length} review</span>` : `<span class="muted">—</span>`}</td>
          <td>${nextSchedule ? `<div title="${h(nextSchedule.cron)}">${h(humanizeCron(nextSchedule.cron, nextSchedule.timezone))}</div><div class="muted" title="${h(nextSchedule.nextRunAt)}">next ${h(relativeTime(nextSchedule.nextRunAt))}</div>` : `<span class="muted">no schedule</span>`}</td>
          <td><div>${channelSummary}</div><div class="muted">${okCount}/${channelHealth.length} ok</div></td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

function renderArtifactStats(artifact: OpsArtifactState): string {
  return `<div class="artifact-stats">
    <span>${tag(`raw ${artifact.rawRecordCount}`)}</span>
    <span>${tag(`files ${artifact.rawFileCount}`)}</span>
    <span>${tag(`evidence ${artifact.normalizedRecordCount}`)}</span>
    <span>${tag(`gamelens ${artifact.gameLensEvidenceCount}`)}</span>
    <div class="muted">last raw: ${h(artifact.lastRawUpdatedAt || "n/a")}</div>
  </div>`;
}

function renderArtifactLinks(artifact: OpsArtifactState): string {
  return `<div class="stack small">
    ${fileLine("report", artifact.reportExists, artifact.reportPath, artifact.reportUpdatedAt)}
    ${fileLine("normalized", artifact.normalizedExists, artifact.normalizedPath)}
    ${fileLine("manifest", artifact.normalizedManifestExists, artifact.normalizedManifestPath)}
    ${fileLine("gamelens", artifact.gameLensHandoffExists, artifact.gameLensHandoffPath)}
  </div>`;
}

function renderRuns(overview: OpsOverview): string {
  if (overview.recentRuns.length === 0) return `<div class="empty">No hub runs yet.</div>`;
  return `<table>
    <thead><tr><th>Run</th><th>Status</th><th>Processed</th><th>Failed</th><th>Ended</th></tr></thead>
    <tbody>${overview.recentRuns.map((run) => `<tr>
      <td class="mono">${h(run.runId)}</td>
      <td>${tag(run.status)}</td>
      <td>${run.processedCount}</td>
      <td>${run.failedCount}</td>
      <td>${h(run.endedAt)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function renderOpsRuns(overview: OpsOverview): string {
  const originMap = new Map<string, string>();
  for (const s of overview.schedules) {
    if (s.lastRunId) originMap.set(s.lastRunId, s.id);
  }
  const topicSet = new Set(overview.recentOpsRuns.map((r) => r.topicId));
  const actionSet = new Set(overview.recentOpsRuns.map((r) => r.action));
  const filtersBar = `<div class="hero-actions inline">
      <select data-runs-filter="status" class="runs-filter">
        <option value="">all status</option>
        <option value="running">running</option>
        <option value="success">success</option>
        <option value="failed">failed</option>
        <option value="partial_failed">partial</option>
      </select>
      <select data-runs-filter="action" class="runs-filter">
        <option value="">all actions</option>
        ${[...actionSet].map((a) => `<option value="${h(a)}">${h(a)}</option>`).join("")}
      </select>
      <select data-runs-filter="origin" class="runs-filter">
        <option value="">all origins</option>
        <option value="manual">manual</option>
        <option value="schedule">schedule</option>
      </select>
      <select data-runs-filter="topic" class="runs-filter">
        <option value="">all topics</option>
        ${[...topicSet].map((t) => `<option value="${h(t)}">${h(t)}</option>`).join("")}
      </select>
      <button type="button" data-cleanup-runs="true" class="secondary">Cleanup Runs</button>
    </div>`;
  if (overview.recentOpsRuns.length === 0) {
    return `<div class="stack">
      ${filtersBar}
      <div class="empty">No ops action runs yet.</div>
    </div>`;
  }
  return `<div class="stack">
    ${filtersBar}
    <table>
    <thead><tr><th>When</th><th>Run</th><th>Action</th><th>Status</th><th>Topic</th><th>Counts</th></tr></thead>
    <tbody>${overview.recentOpsRuns.map((run) => {
      const origin = originMap.get(run.runId);
      const originLabel = origin ? "schedule" : "manual";
      const when = run.endedAt || run.startedAt;
      return `<tr class="clickable" data-run-drawer="${h(run.runId)}" data-run-status="${h(run.status)}" data-run-action="${h(run.action)}" data-run-origin="${originLabel}" data-run-topic="${h(run.topicId)}">
      <td class="muted" title="${h(when)}">${h(relativeTime(when))}</td>
      <td><span class="mono" title="${h(run.runId)}">${h(shortenId(run.runId))}</span></td>
      <td>${tag(run.action)} <span class="muted">· ${originLabel}${origin ? ` ${h(shortenId(origin))}` : ""}</span></td>
      <td>${tag(run.status)}</td>
      <td><span class="mono">${h(run.topicId)}</span></td>
      <td>${run.rawRecordCount} raw / ${run.normalizedEvidenceCount} ev</td>
    </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function metricCard(label: string, value: string | number, note: string): string {
  return `<article class="card"><div class="metric-label">${h(label)}</div><div class="metric-value">${h(String(value))}</div><div class="muted">${h(note)}</div></article>`;
}

function fileLine(label: string, ok: boolean, filePath: string, updatedAt = ""): string {
  return `<div>${tag(ok ? "exists" : "missing")} <b>${h(label)}</b><div class="mono">${h(filePath)}</div>${updatedAt ? `<div class="muted">updated: ${h(updatedAt)}</div>` : ""}</div>`;
}

function kv(key: string, value: string): string {
  return `<tr><th>${h(key)}</th><td>${h(value || "n/a")}</td></tr>`;
}

function tag(value: string): string {
  const cls = /ready|success|exists|active|ok|completed/.test(value) ? "ok" : /missing|failed|warning|needs_key/.test(value) ? "warn" : "";
  return `<span class="tag ${cls}">${h(value)}</span>`;
}

function h(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function shortenId(id: string, keepTail = 8): string {
  if (!id) return "";
  if (id.length <= keepTail + 2) return id;
  return "…" + id.slice(-keepTail);
}

function humanizeCron(cron: string, timezone = ""): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, hr, dom, mon, dow] = parts;
  const pad = (s: string) => s.padStart(2, "0");
  const tz = timezone ? ` ${timezone}` : "";
  if (m === "0" || /^\d+$/.test(m)) {
    if (hr === "*" && dom === "*" && mon === "*" && dow === "*") {
      return `hourly at :${pad(m)}${tz}`;
    }
    if (/^\d+$/.test(hr) && dom === "*" && mon === "*" && dow === "*") {
      return `daily at ${pad(hr)}:${pad(m)}${tz}`;
    }
    if (/^\d+$/.test(hr) && dom === "*" && mon === "*" && /^\d+$/.test(dow)) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const d = days[Number(dow)] || dow;
      return `weekly ${d} ${pad(hr)}:${pad(m)}${tz}`;
    }
    const everyN = hr.match(/^\*\/(\d+)$/);
    if (everyN && dom === "*" && mon === "*" && dow === "*") {
      return `every ${everyN[1]}h at :${pad(m)}${tz}`;
    }
  }
  return `${cron}${tz}`;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  const abs = Math.abs(diffSec);
  const futureSuffix = diffSec < 0 ? " from now" : " ago";
  if (abs < 60) return `${abs}s${futureSuffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)}m${futureSuffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h${futureSuffix}`;
  return `${Math.round(abs / 86400)}d${futureSuffix}`;
}

function clientScript(): string {
  return `
    // === Top-level helpers (reused across all handlers) ===

    async function withButtonLock(button, label, fn) {
      if (button.disabled) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = label || "Running...";
      try {
        await fn();
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
    }

    function buildCron(formEl) {
      const freq = formEl.querySelector("[name=frequency]")?.value || "daily";
      const time = formEl.querySelector("[name=time]")?.value || "09:00";
      const [hhRaw, mmRaw] = time.split(":");
      const HH = Math.max(0, Math.min(23, parseInt(hhRaw, 10) || 0));
      const MM = Math.max(0, Math.min(59, parseInt(mmRaw, 10) || 0));
      if (freq === "daily") return MM + " " + HH + " * * *";
      if (freq === "weekly") {
        const wd = formEl.querySelector("[name=weekday]")?.value || "1";
        return MM + " " + HH + " * * " + wd;
      }
      if (freq === "hourly") return MM + " * * * *";
      if (freq === "every_n_hours") {
        const raw = formEl.querySelector("[name=everyNHours]")?.value || "6";
        const n = Math.max(1, Math.min(24, parseInt(raw, 10) || 6));
        return MM + " */" + n + " * * *";
      }
      return MM + " " + HH + " * * *";
    }

    function updateProviderDefaults(option, formEl) {
      if (!formEl || !option) return;
      let sources = [];
      try { sources = JSON.parse(option.dataset?.sources || "[]"); } catch (_) {}
      const set = new Set(sources);
      formEl.querySelectorAll("input[name=providers]").forEach((checkbox) => {
        if (checkbox.disabled) return;
        checkbox.checked = set.has(checkbox.value);
      });
    }

    function applyRunsFilters() {
      const filters = {};
      document.querySelectorAll("[data-runs-filter]").forEach((s) => {
        const key = s.getAttribute("data-runs-filter");
        if (s.value) filters[key] = s.value;
      });
      document.querySelectorAll("tr[data-run-status]").forEach((row) => {
        let visible = true;
        for (const key in filters) {
          if (row.getAttribute("data-run-" + key) !== filters[key]) {
            visible = false;
            break;
          }
        }
        row.style.display = visible ? "" : "none";
      });
    }

    // === URL routing + partial refresh ===

    async function navigateTo(url, options) {
      options = options || {};
      // Clear any auto-refresh poller from the previous tab before swapping
      if (window.__opsAutoRefreshTimer) {
        clearInterval(window.__opsAutoRefreshTimer);
        window.__opsAutoRefreshTimer = null;
      }
      try {
        const response = await fetch(url, { headers: { "accept": "text/html" } });
        if (!response.ok) throw new Error("nav " + url + " failed: " + response.status);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const match = url.match(/^\\/ops\\/([a-z-]+)/);
        const targetTab = match ? match[1] : "dashboard";

        document.querySelectorAll(".tab-body").forEach((existing) => {
          const tabName = existing.getAttribute("data-tab-body");
          const newBody = doc.querySelector(".tab-body[data-tab-body='" + tabName + "']");
          if (newBody) {
            existing.innerHTML = newBody.innerHTML;
            existing.classList.toggle("hidden", tabName !== targetTab);
          }
        });
        document.querySelectorAll(".ops-tabs .tab").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-tab") === targetTab);
        });

        if (!options.replace) {
          history.pushState({}, "", url);
        }

        document.title = doc.title;
        bindContentHandlers();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("navigateTo failed, falling back to full reload:", error);
        window.location.href = url;
      }
    }

    function refreshCurrentTab() {
      return navigateTo(window.location.pathname, { replace: true });
    }

    // Tab nav clicks: anchor + data-tab. Bound once since nav is outside the swap area.
    document.querySelectorAll(".ops-tabs .tab").forEach((tabEl) => {
      tabEl.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const target = tabEl.getAttribute("data-tab");
        if (!target) return;
        e.preventDefault();
        navigateTo("/ops/" + target);
      });
    });

    window.addEventListener("popstate", () => {
      navigateTo(window.location.pathname, { replace: true });
    });

    // === Drawer (outside swap area, bind once) ===

    const drawer = document.getElementById("review-drawer");
    const drawerBody = document.getElementById("drawer-body");
    const drawerActions = document.getElementById("drawer-actions");
    const drawerTitle = document.getElementById("drawer-title");

    function openDrawer() {
      if (!drawer) return;
      drawer.classList.remove("hidden");
      drawer.setAttribute("aria-hidden", "false");
    }
    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.add("hidden");
      drawer.setAttribute("aria-hidden", "true");
    }

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.matches && target.matches("[data-drawer-close]")) {
        closeDrawer();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer && !drawer.classList.contains("hidden")) {
        closeDrawer();
      }
    });

    async function openPreviewDrawer(id) {
      if (!drawer || !drawerBody || !drawerActions || !drawerTitle) return;
      drawerTitle.textContent = "Preview " + id;
      drawerBody.innerHTML = '<div class="empty">Loading preview…</div>';
      drawerActions.innerHTML = '<button type="button" data-drawer-close class="pill secondary">Close</button>';
      openDrawer();
      try {
        const response = await fetch("/ops/review-queue/" + encodeURIComponent(id) + "/preview.json");
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || json.error || "preview failed");
        renderDrawerPreview(json);
      } catch (error) {
        drawerBody.innerHTML = '<div class="empty warn">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</div>';
      }
    }

    function openRunNowDrawer(payload) {
      if (!drawer || !drawerBody || !drawerActions || !drawerTitle) return;
      const providers = (payload.providers || []);
      drawerTitle.textContent = "Run Now — " + (payload.name || payload.topicId);
      drawerBody.innerHTML =
        '<form id="run-now-form" style="display:grid;gap:12px">' +
          '<label>Topic<input value="' + escapeHtml(payload.name + " / " + payload.topicId) + '" disabled /></label>' +
          '<div>' +
            '<label class="muted" style="display:block;margin-bottom:6px">Channels (uncheck to skip)</label>' +
            '<div class="provider-checks">' +
              providers.map((p) => '<label class="check"><input type="checkbox" name="rnProvider" value="' + escapeHtml(p) + '" checked /> <span>' + escapeHtml(p) + '</span></label>').join("") +
            '</div>' +
            (providers.length === 0 ? '<div class="empty warn">No ready channels for this topic. Configure env first.</div>' : "") +
          '</div>' +
          '<label>Query (defaults to topic name)<input name="rnQuery" placeholder="' + escapeHtml(payload.name || "") + '" /></label>' +
          '<label>Limit<input name="rnLimit" type="number" min="1" max="25" value="10" /><small class="muted">max 25 per run</small></label>' +
          '<label class="check"><input type="checkbox" name="rnDryRun" /> <span>dry-run (no real fetch)</span></label>' +
        '</form>' +
        '<div id="run-now-result" class="empty" style="margin-top:12px">Submits a one-shot collect-and-normalize run.</div>';
      drawerActions.innerHTML =
        '<button type="button" data-run-now-submit ' + (providers.length === 0 ? "disabled" : "") + '>Submit Run</button>' +
        '<button type="button" data-drawer-close class="pill secondary">Cancel</button>';
      drawerActions.querySelector("[data-run-now-submit]")?.addEventListener("click", function (e) {
        withButtonLock(e.currentTarget, "Submitting…", async () => {
          const form = document.getElementById("run-now-form");
          const resultEl = document.getElementById("run-now-result");
          if (!form || !resultEl) return;
          const data = new FormData(form);
          const selectedProviders = data.getAll("rnProvider").map(String);
          if (selectedProviders.length === 0) {
            resultEl.className = "empty warn";
            resultEl.textContent = "Select at least one channel.";
            return;
          }
          const requestPayload = {
            topicId: payload.topicId,
            projectId: payload.projectId || undefined,
            providers: selectedProviders,
            query: String(data.get("rnQuery") || "").trim() || undefined,
            limit: Number(data.get("rnLimit") || 10),
            dryRun: data.get("rnDryRun") === "on",
          };
          resultEl.className = "empty";
          resultEl.textContent = "Running collect-and-normalize…";
          try {
            const response = await fetch("/ops/runs/collect-and-normalize-topic", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestPayload),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || json.error || "run failed");
            resultEl.className = "empty ok";
            resultEl.innerHTML = "<b>" + escapeHtml(json.status) + "</b> " + escapeHtml(json.runId) +
              " · raw=" + escapeHtml(String(json.rawRecordCount || 0)) +
              " · evidence=" + escapeHtml(String(json.normalizedEvidenceCount || 0));
            setTimeout(() => { closeDrawer(); refreshCurrentTab(); }, 1200);
          } catch (error) {
            resultEl.className = "empty warn";
            resultEl.textContent = error instanceof Error ? error.message : String(error);
          }
        });
      });
      openDrawer();
    }

    function classifyStderr(text) {
      if (!text) return null;
      if (/status=429/i.test(text)) return { code: "rate_limit", label: "rate limit" };
      if (/status=40[13]/.test(text) || /unauthor|forbidden/i.test(text)) return { code: "auth", label: "auth failed" };
      if (/status=5\\d\\d/.test(text)) return { code: "upstream", label: "upstream 5xx" };
      if (/_API_KEY is required|missing required env/i.test(text)) return { code: "missing_env", label: "missing env" };
      if (/timed ?out|ETIMEDOUT/i.test(text)) return { code: "timeout", label: "timeout" };
      if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(text)) return { code: "network", label: "network" };
      return null;
    }

    async function openRunDrawer(runId) {
      if (!drawer || !drawerBody || !drawerActions || !drawerTitle) return;
      drawerTitle.textContent = "Run " + runId;
      drawerBody.innerHTML = '<div class="empty">Loading run…</div>';
      drawerActions.innerHTML = '<button type="button" data-drawer-close class="pill secondary">Close</button>';
      openDrawer();
      try {
        const [runResp, logsResp] = await Promise.all([
          fetch("/ops/runs/" + encodeURIComponent(runId)),
          fetch("/ops/runs/" + encodeURIComponent(runId) + "/logs"),
        ]);
        const run = await runResp.json();
        const logsJson = logsResp.ok ? await logsResp.json() : { logs: [] };
        if (!runResp.ok) throw new Error(run.message || run.error || "run not found");
        renderRunDrawer(run, logsJson.logs || []);
      } catch (error) {
        drawerBody.innerHTML = '<div class="empty warn">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</div>';
      }
    }

    function renderRunDrawer(run, logs) {
      if (!drawerBody || !drawerActions) return;
      const cmds = Array.isArray(run.commandResults) ? run.commandResults : [];
      const providers = Array.isArray(run.providers) ? run.providers : [];
      const isRunning = run.status === "running";
      let html = '<table class="kv">' +
        '<tr><th>runId</th><td class="mono">' + escapeHtml(run.runId || "") + '</td></tr>' +
        '<tr><th>action</th><td>' + escapeHtml(run.action || "") + '</td></tr>' +
        '<tr><th>status</th><td>' + escapeHtml(run.status || "") + '</td></tr>' +
        '<tr><th>topic</th><td class="mono">' + escapeHtml(run.topicId || "") + '</td></tr>' +
        '<tr><th>providers</th><td>' + providers.map(escapeHtml).join(", ") + '</td></tr>' +
        '<tr><th>started</th><td class="mono">' + escapeHtml(run.startedAt || "") + '</td></tr>' +
        '<tr><th>ended</th><td class="mono">' + escapeHtml(run.endedAt || "(running)") + '</td></tr>' +
        '<tr><th>raw / evidence</th><td>' + (run.rawRecordCount || 0) + ' / ' + (run.normalizedEvidenceCount || 0) + '</td></tr>' +
        '</table>';

      // Phase inference from logs (works for both running and completed runs)
      if (logs.length > 0) {
        const lastCollect = [...logs].reverse().find((l) => /Collecting provider=/.test(String(l.message || "")));
        const normalizing = logs.some((l) => /Normalizing topic evidence/.test(String(l.message || "")));
        const finished = logs.some((l) => /^Finished /.test(String(l.message || "")));
        let phase = "starting";
        if (finished) phase = "done";
        else if (normalizing) phase = "normalizing";
        else if (lastCollect) {
          const m = String(lastCollect.message).match(/Collecting provider=(\\S+)/);
          phase = m ? "collecting:" + m[1] : "collecting";
        }
        html += '<h3 style="margin:18px 0 8px;font-size:15px">Phase</h3>';
        html += '<div class="mono">' + escapeHtml(phase) + '</div>';
      }

      if (run.errorText) {
        html += '<h3 style="margin:18px 0 8px;font-size:15px">Error</h3>';
        html += '<div class="empty warn">' + escapeHtml(String(run.errorText)) + '</div>';
      }

      if (cmds.length > 0) {
        html += '<h3 style="margin:18px 0 8px;font-size:15px">Commands</h3>';
        html += '<table><thead><tr><th>Label</th><th>Exit</th><th>Issue</th></tr></thead><tbody>';
        for (const cmd of cmds) {
          const stderr = String(cmd.stderr || "");
          const classified = classifyStderr(stderr);
          const issueCell = cmd.timedOut ? '<span class="icon warn">timeout</span>'
            : (classified ? '<span class="icon warn">' + escapeHtml(classified.label) + '</span>'
              : (cmd.exitCode === 0 ? '<span class="icon ok">ok</span>' : (stderr.slice(0, 80) ? escapeHtml(stderr.slice(0, 80)) : "")));
          html += '<tr><td>' + escapeHtml(String(cmd.label || "")) + '</td>' +
            '<td>' + escapeHtml(String(cmd.exitCode ?? "")) + '</td>' +
            '<td>' + issueCell + '</td></tr>';
        }
        html += '</tbody></table>';
      }

      html += '<details style="margin-top:18px"><summary>Logs (' + logs.length + ' entries)</summary>';
      html += '<pre class="mono" style="white-space:pre-wrap;max-height:300px;overflow:auto;background:#fff;padding:12px;border-radius:8px;border:1px solid var(--line);margin-top:8px">';
      html += logs.slice(-30).map((l) => escapeHtml((l.timestamp || "") + " [" + (l.level || "") + "] " + (l.message || ""))).join("\\n");
      html += '</pre></details>';

      html += '<details style="margin-top:8px"><summary>Paths</summary><table class="kv" style="margin-top:8px">' +
        '<tr><th>runDir</th><td class="mono">' + escapeHtml(run.runDir || "") + '</td></tr>' +
        '<tr><th>reportPath</th><td class="mono">' + escapeHtml(run.reportPath || "") + '</td></tr>' +
        '<tr><th>logPath</th><td class="mono">' + escapeHtml(run.logPath || "") + '</td></tr>' +
        '</table></details>';

      drawerBody.innerHTML = html;
      const buttons = ['<a href="/ops/runs/' + encodeURIComponent(run.runId) + '/view" class="pill secondary">Full Page</a>'];
      if (!isRunning && run.status !== "success") {
        buttons.push('<button type="button" data-drawer-retry="' + escapeHtml(run.runId) + '">Retry</button>');
      }
      buttons.push('<button type="button" data-drawer-close class="pill secondary">Close</button>');
      drawerActions.innerHTML = buttons.join("");
      drawerActions.querySelectorAll("[data-drawer-retry]").forEach((btn) => {
        btn.addEventListener("click", () => withButtonLock(btn, "Retrying…", async () => {
          const id = btn.getAttribute("data-drawer-retry");
          const response = await fetch("/ops/runs/" + encodeURIComponent(id) + "/retry", { method: "POST" });
          const json = await response.json();
          const cleanupResult = document.getElementById("ops-cleanup-result");
          if (cleanupResult) {
            cleanupResult.className = response.ok ? "empty ok" : "empty warn";
            cleanupResult.textContent = response.ok
              ? "retry created " + json.runId + " · status=" + json.status
              : (json.message || json.error || "retry failed");
          }
          closeDrawer();
          if (response.ok) setTimeout(refreshCurrentTab, 400);
        }));
      });
    }

    async function openScheduleDrawer(scheduleId) {
      if (!drawer || !drawerBody || !drawerActions || !drawerTitle) return;
      drawerTitle.textContent = "Schedule " + scheduleId;
      drawerBody.innerHTML = '<div class="empty">Loading schedule…</div>';
      drawerActions.innerHTML = '<button type="button" data-drawer-close class="pill secondary">Close</button>';
      openDrawer();
      try {
        const response = await fetch("/ops/schedules/" + encodeURIComponent(scheduleId));
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || json.error || "schedule not found");
        renderScheduleDrawer(json);
      } catch (error) {
        drawerBody.innerHTML = '<div class="empty warn">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</div>';
      }
    }

    function renderScheduleDrawer(s) {
      if (!drawerBody || !drawerActions) return;
      let html = '<table class="kv">' +
        '<tr><th>id</th><td class="mono">' + escapeHtml(s.id) + '</td></tr>' +
        '<tr><th>status</th><td>' + escapeHtml(s.status) + '</td></tr>' +
        '<tr><th>action</th><td>' + escapeHtml(s.action) + '</td></tr>' +
        '<tr><th>topic</th><td class="mono">' + escapeHtml(s.topicId) + '</td></tr>' +
        '<tr><th>providers</th><td>' + (s.providers || []).map(escapeHtml).join(", ") + '</td></tr>' +
        '<tr><th>cron</th><td class="mono">' + escapeHtml(s.cron) + '</td></tr>' +
        '<tr><th>timezone</th><td>' + escapeHtml(s.timezone) + '</td></tr>' +
        '<tr><th>next run</th><td class="mono">' + escapeHtml(s.nextRunAt) + '</td></tr>' +
        '<tr><th>last run</th><td class="mono">' + escapeHtml(s.lastRunAt || "never") + '</td></tr>' +
        (s.lastRunId ? '<tr><th>last run id</th><td><a href="/ops/runs/' + encodeURIComponent(s.lastRunId) + '/view" class="mono">' + escapeHtml(s.lastRunId) + '</a></td></tr>' : '') +
        (s.lastRunStatus ? '<tr><th>last status</th><td>' + escapeHtml(s.lastRunStatus) + '</td></tr>' : '') +
        '<tr><th>dry-run</th><td>' + String(s.dryRun) + '</td></tr>' +
        (s.query ? '<tr><th>query</th><td>' + escapeHtml(s.query) + '</td></tr>' : '') +
        '<tr><th>limit</th><td>' + (s.limit || 10) + '</td></tr>' +
        '<tr><th>created</th><td class="mono">' + escapeHtml(s.createdAt) + '</td></tr>' +
        '</table>';
      drawerBody.innerHTML = html;
      const buttons = [];
      if (s.status === "active") {
        buttons.push('<button type="button" data-drawer-schedule="pause" data-drawer-id="' + escapeHtml(s.id) + '" class="secondary">Pause</button>');
      } else {
        buttons.push('<button type="button" data-drawer-schedule="resume" data-drawer-id="' + escapeHtml(s.id) + '">Resume</button>');
      }
      buttons.push('<button type="button" data-drawer-schedule="run-now" data-drawer-id="' + escapeHtml(s.id) + '" class="secondary">Run Now</button>');
      buttons.push('<button type="button" data-drawer-schedule="delete" data-drawer-id="' + escapeHtml(s.id) + '" class="secondary">Delete</button>');
      buttons.push('<button type="button" data-drawer-close class="pill secondary">Close</button>');
      drawerActions.innerHTML = buttons.join("");
      drawerActions.querySelectorAll("[data-drawer-schedule]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-drawer-schedule");
          const id = btn.getAttribute("data-drawer-id");
          if (!id || !action) return;
          if (action === "delete" && !confirm("Delete schedule " + id + "? Existing runs are kept.")) return;
          withButtonLock(btn, "Working…", async () => {
            let response;
            if (action === "pause" || action === "resume") {
              response = await fetch("/ops/schedules/" + encodeURIComponent(id), {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status: action === "pause" ? "paused" : "active" }),
              });
            } else if (action === "run-now") {
              response = await fetch("/ops/schedules/" + encodeURIComponent(id) + "/run-now", { method: "POST" });
            } else if (action === "delete") {
              response = await fetch("/ops/schedules/" + encodeURIComponent(id), { method: "DELETE" });
            } else {
              return;
            }
            const json = await response.json();
            const scheduleResult = document.getElementById("ops-schedule-result");
            if (scheduleResult) {
              scheduleResult.className = response.ok ? "empty ok" : "empty warn";
              scheduleResult.textContent = response.ok
                ? action + " " + id + " ok"
                : (json.message || json.error || "request failed");
            }
            closeDrawer();
            if (response.ok) setTimeout(refreshCurrentTab, 400);
          });
        });
      });
    }

    function renderDrawerPreview(data) {
      if (!drawerBody || !drawerActions) return;
      const item = data.item;
      const sample = data.normalizedSample || [];
      const handoff = data.handoff;
      let html = '<table class="kv">' +
        '<tr><th>id</th><td>' + escapeHtml(item.id) + '</td></tr>' +
        '<tr><th>status</th><td>' + escapeHtml(item.status) + '</td></tr>' +
        '<tr><th>topic</th><td>' + escapeHtml(item.topicId) + '</td></tr>' +
        '<tr><th>providers</th><td>' + item.providers.map(escapeHtml).join(", ") + '</td></tr>' +
        '<tr><th>raw / evidence</th><td>' + item.rawRecordCount + ' / ' + item.normalizedEvidenceCount + '</td></tr>' +
        '<tr><th>handoff path</th><td class="mono">' + escapeHtml(item.handoffPath || "n/a") + '</td></tr>' +
        '</table>';
      html += '<h3 style="margin:18px 0 8px;font-size:15px">Normalized Sample (' + sample.length + ' rows)</h3>';
      if (sample.length === 0) {
        html += '<div class="empty warn">No normalized records readable.</div>';
      } else {
        html += '<table><thead><tr><th>Source</th><th>Title</th><th>URL</th></tr></thead><tbody>';
        for (const row of sample) {
          html += '<tr>' +
            '<td>' + escapeHtml(String(row.source || row.platform || "?")) + '</td>' +
            '<td>' + escapeHtml(String(row.title || row.headline || "").slice(0, 200)) + '</td>' +
            '<td class="mono">' + escapeHtml(String(row.sourceUrl || row.url || "").slice(0, 100)) + '</td>' +
            '</tr>';
        }
        html += '</tbody></table>';
      }
      if (handoff) {
        html += '<h3 style="margin:18px 0 8px;font-size:15px">Handoff</h3>';
        html += '<pre class="mono" style="white-space:pre-wrap;max-height:300px;overflow:auto;background:#fff;padding:12px;border-radius:8px;border:1px solid var(--line)">' + escapeHtml(JSON.stringify(handoff, null, 2).slice(0, 2000)) + '</pre>';
      }
      drawerBody.innerHTML = html;
      if (item.status === "pending") {
        drawerActions.innerHTML =
          '<button type="button" data-drawer-decision="approved" data-drawer-id="' + escapeHtml(item.id) + '">Approve</button>' +
          '<button type="button" data-drawer-decision="rejected" data-drawer-id="' + escapeHtml(item.id) + '" class="secondary">Reject</button>' +
          '<button type="button" data-drawer-close class="pill secondary">Cancel</button>';
      } else {
        drawerActions.innerHTML =
          '<span class="muted">' + escapeHtml(item.status) + (item.decisionNote ? " · " + escapeHtml(item.decisionNote) : "") + '</span>' +
          '<button type="button" data-drawer-close class="pill secondary">Close</button>';
      }
      drawerActions.querySelectorAll("[data-drawer-decision]").forEach((btn) => {
        btn.addEventListener("click", () => withButtonLock(btn, "Saving…", async () => {
          const id = btn.getAttribute("data-drawer-id");
          const status = btn.getAttribute("data-drawer-decision");
          if (!id || !status) return;
          const response = await fetch("/ops/review-queue/" + encodeURIComponent(id) + "/decision", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status, reviewer: "ops-ui" }),
          });
          const json = await response.json();
          const reviewResult = document.getElementById("ops-review-result");
          if (!response.ok) {
            if (reviewResult) {
              reviewResult.className = "empty warn";
              reviewResult.textContent = json.message || json.error || "review failed";
            }
            return;
          }
          if (reviewResult) {
            reviewResult.className = "empty ok";
            reviewResult.textContent = "review " + json.id + " -> " + json.status;
          }
          closeDrawer();
          setTimeout(refreshCurrentTab, 400);
        }));
      });
    }

    // === Content handlers (re-bound after each tab body swap) ===

    function bindContentHandlers() {
      const resultBox = document.getElementById("ops-action-result");
      const cleanupResult = document.getElementById("ops-cleanup-result") || resultBox;
      const reviewResult = document.getElementById("ops-review-result") || resultBox;
      const scheduleResult = document.getElementById("ops-schedule-result") || resultBox;

      const form = document.getElementById("ops-run-form");
      if (form) {
        const modeSelect = form.querySelector("select[name=mode]");
        const frequencySelect = form.querySelector("select[name=frequency]");
        const topicSelect = form.querySelector("select[name=topicId]");

        const updateModeBlocks = () => {
          const mode = modeSelect?.value || "oneshot";
          form.querySelectorAll("[data-mode-block]").forEach((el) => {
            el.style.display = (el.getAttribute("data-mode-block") === mode) ? "" : "none";
          });
          form.querySelectorAll("[data-run-mode]").forEach((btn) => {
            btn.style.display = (btn.getAttribute("data-run-mode") === mode) ? "" : "none";
          });
        };
        const updateFrequencyFields = () => {
          const value = frequencySelect?.value || "daily";
          form.querySelectorAll("[data-freq-show]").forEach((label) => {
            label.style.display = (label.getAttribute("data-freq-show") === value) ? "" : "none";
          });
        };

        modeSelect?.addEventListener("change", updateModeBlocks);
        frequencySelect?.addEventListener("change", updateFrequencyFields);
        topicSelect?.addEventListener("change", () => {
          const option = topicSelect.selectedOptions[0];
          const queryInput = form.querySelector("input[name=query]");
          const nextTopicQuery = option?.dataset?.query || "";
          const previousTopicQuery = form.dataset.prevQuery || "";
          if (queryInput && (!queryInput.value || queryInput.value === previousTopicQuery)) {
            queryInput.value = nextTopicQuery;
          }
          form.dataset.prevQuery = nextTopicQuery;
          updateProviderDefaults(option, form);
        });

        updateModeBlocks();
        updateFrequencyFields();
      }

      document.querySelectorAll("[data-run-mode]").forEach((button) => {
        button.addEventListener("click", () => withButtonLock(button, "Submitting…", async () => {
          const formEl = document.getElementById("ops-run-form");
          if (!formEl || !resultBox) return;
          const data = new FormData(formEl);
          const mode = String(data.get("mode") || "oneshot");
          const action = String(data.get("action") || "collect-and-normalize-topic");
          const topicId = String(data.get("topicId") || "");
          const topicSelect = formEl.querySelector("select[name=topicId]");
          const topicOption = topicSelect?.selectedOptions[0];
          const providers = data.getAll("providers").map(String);
          const query = String(data.get("query") || "").trim();
          const limit = Number(data.get("limit") || 10);
          const dryRun = data.get("dryRun") === "on";
          resultBox.className = "empty";
          if (mode === "oneshot") {
            resultBox.textContent = "Running " + action + " ...";
            const payload = {
              topicId, query, limit, providers, dryRun,
              includeDryRun: data.get("includeDryRun") === "on",
              appId: String(data.get("appId") || ""),
              subreddit: String(data.get("subreddit") || ""),
              gameIds: String(data.get("gameIds") || ""),
            };
            try {
              const response = await fetch("/ops/runs/" + action, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.message || json.error || "request failed");
              resultBox.className = "empty ok";
              resultBox.innerHTML = "<b>" + escapeHtml(json.status) + "</b> " + escapeHtml(json.runId) +
                " · raw=" + escapeHtml(String(json.rawRecordCount || 0)) +
                " · evidence=" + escapeHtml(String(json.normalizedEvidenceCount || 0)) +
                " · <a href=\\"/ops/runs/" + encodeURIComponent(json.runId) + "/view\\">open run detail</a>";
              setTimeout(refreshCurrentTab, 800);
            } catch (error) {
              resultBox.className = "empty warn";
              resultBox.textContent = error instanceof Error ? error.message : String(error);
            }
          } else {
            resultBox.textContent = "Creating schedule...";
            const payload = {
              topicId,
              projectId: String(topicOption?.dataset?.project || ""),
              providers, action,
              query: query || undefined,
              limit, dryRun,
              cron: buildCron(formEl),
              timezone: String(data.get("timezone") || "Asia/Shanghai"),
            };
            try {
              const response = await fetch("/ops/schedules", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.message || json.error || "create failed");
              resultBox.className = "empty ok";
              resultBox.textContent = "schedule " + json.id + " created · next run " + json.nextRunAt;
              setTimeout(refreshCurrentTab, 800);
            } catch (error) {
              resultBox.className = "empty warn";
              resultBox.textContent = error instanceof Error ? error.message : String(error);
            }
          }
        }));
      });

      document.querySelectorAll("[data-retry-run]").forEach((button) => {
        button.addEventListener("click", () => withButtonLock(button, "Retrying…", async () => {
          const runId = button.getAttribute("data-retry-run");
          if (!runId || !cleanupResult) return;
          cleanupResult.className = "empty";
          cleanupResult.textContent = "Retrying " + runId + " ...";
          try {
            const response = await fetch("/ops/runs/" + encodeURIComponent(runId) + "/retry", { method: "POST" });
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || json.error || "retry failed");
            cleanupResult.className = "empty ok";
            cleanupResult.innerHTML = "retry created <b>" + escapeHtml(json.runId) + "</b> · status=" + escapeHtml(json.status);
            setTimeout(refreshCurrentTab, 600);
          } catch (error) {
            cleanupResult.className = "empty warn";
            cleanupResult.textContent = error instanceof Error ? error.message : String(error);
          }
        }));
      });

      document.querySelectorAll("[data-cleanup-runs]").forEach((button) => {
        button.addEventListener("click", () => {
          if (!confirm("Cleanup will delete old run directories based on retention policy. Continue?")) return;
          withButtonLock(button, "Cleaning…", async () => {
            if (!cleanupResult) return;
            const response = await fetch("/ops/runs/cleanup", { method: "POST" });
            const json = await response.json();
            cleanupResult.className = response.ok ? "empty ok" : "empty warn";
            cleanupResult.textContent = response.ok
              ? "cleanup deleted=" + json.deletedCount + ", kept=" + json.keptCount
              : (json.message || json.error || "cleanup failed");
            if (response.ok) setTimeout(refreshCurrentTab, 400);
          });
        });
      });

      document.querySelectorAll("[data-review]").forEach((button) => {
        button.addEventListener("click", () => withButtonLock(button, "Saving…", async () => {
          if (!reviewResult) return;
          const id = button.getAttribute("data-review");
          const status = button.getAttribute("data-status");
          const response = await fetch("/ops/review-queue/" + encodeURIComponent(id) + "/decision", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status, reviewer: "ops-ui" }),
          });
          const json = await response.json();
          reviewResult.className = response.ok ? "empty ok" : "empty warn";
          reviewResult.textContent = response.ok
            ? "review " + json.id + " -> " + json.status
            : (json.message || json.error || "review decision failed");
          if (response.ok) setTimeout(refreshCurrentTab, 400);
        }));
      });

      document.querySelectorAll("[data-schedule-action]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.getAttribute("data-schedule-action");
          const id = button.getAttribute("data-schedule-id");
          if (!id || !action) return;
          if (action === "delete" && !confirm("Delete schedule " + id + "? Existing runs are kept.")) return;
          withButtonLock(button, "Working…", async () => {
            if (!scheduleResult) return;
            scheduleResult.className = "empty";
            scheduleResult.textContent = action + " " + id + "...";
            try {
              let response;
              if (action === "pause") {
                response = await fetch("/ops/schedules/" + encodeURIComponent(id), {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ status: "paused" }),
                });
              } else if (action === "resume") {
                response = await fetch("/ops/schedules/" + encodeURIComponent(id), {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ status: "active" }),
                });
              } else if (action === "run-now") {
                response = await fetch("/ops/schedules/" + encodeURIComponent(id) + "/run-now", { method: "POST" });
              } else if (action === "delete") {
                response = await fetch("/ops/schedules/" + encodeURIComponent(id), { method: "DELETE" });
              } else {
                return;
              }
              const json = await response.json();
              if (!response.ok) throw new Error(json.message || json.error || "request failed");
              scheduleResult.className = "empty ok";
              scheduleResult.textContent = action + " " + id + " ok";
              setTimeout(refreshCurrentTab, 400);
            } catch (error) {
              scheduleResult.className = "empty warn";
              scheduleResult.textContent = error instanceof Error ? error.message : String(error);
            }
          });
        });
      });

      document.querySelectorAll("[data-topic-expand]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const topicId = btn.getAttribute("data-topic-expand");
          const detail = document.querySelector("[data-topic-details='" + topicId + "']");
          if (!detail) return;
          detail.classList.toggle("hidden");
          const isHidden = detail.classList.contains("hidden");
          btn.textContent = btn.textContent.replace(/[▸▾]/, isHidden ? "▸" : "▾");
        });
      });

      document.querySelectorAll("[data-runs-filter]").forEach((select) => {
        select.addEventListener("change", applyRunsFilters);
      });

      // Topics filter bar
      const topicsFilterEls = document.querySelectorAll("[data-topics-filter]");
      const topicsCountEl = document.querySelector("[data-topics-count]");
      function applyTopicsFilters() {
        const filters = {};
        let searchTerm = "";
        topicsFilterEls.forEach((el) => {
          const key = el.getAttribute("data-topics-filter");
          if (key === "search") searchTerm = (el.value || "").toLowerCase().trim();
          else if (el.value) filters[key] = el.value;
        });
        let visibleCount = 0;
        document.querySelectorAll("tr[data-topic-drawer]").forEach((row) => {
          let visible = true;
          for (const key in filters) {
            if (row.getAttribute("data-topic-" + key.toLowerCase()) !== filters[key]) {
              visible = false;
              break;
            }
          }
          if (visible && searchTerm) {
            const hay = row.getAttribute("data-topic-search") || "";
            if (!hay.includes(searchTerm)) visible = false;
          }
          row.style.display = visible ? "" : "none";
          if (visible) visibleCount += 1;
        });
        if (topicsCountEl) {
          const total = document.querySelectorAll("tr[data-topic-drawer]").length;
          topicsCountEl.textContent = visibleCount + " of " + total;
        }
      }
      topicsFilterEls.forEach((el) => {
        const evt = el.tagName.toLowerCase() === "input" ? "input" : "change";
        el.addEventListener(evt, applyTopicsFilters);
      });
      // Apply default filter (status=active by default in select)
      if (topicsFilterEls.length > 0) applyTopicsFilters();

      document.querySelectorAll("[data-topic-runnow]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const raw = btn.getAttribute("data-topic-runnow") || "{}";
          try {
            const payload = JSON.parse(raw);
            openRunNowDrawer(payload);
          } catch (_) {}
        });
      });

      document.querySelectorAll("[data-provider-test]").forEach((button) => {
        button.addEventListener("click", () => withButtonLock(button, "Testing…", async () => {
          const id = button.getAttribute("data-provider-test");
          const resultEl = document.querySelector("[data-provider-test-result='" + id + "']");
          if (resultEl) resultEl.textContent = " testing...";
          try {
            const response = await fetch("/ops/providers/" + encodeURIComponent(id) + "/test", { method: "POST" });
            const json = await response.json();
            if (!resultEl) return;
            if (json.ok) {
              resultEl.innerHTML = ' <span class="icon ok">ok ' + (json.elapsedMs || 0) + 'ms</span>';
            } else {
              const reason = json.reason || "failed";
              const extra = json.httpStatus ? " " + json.httpStatus : (json.env ? " " + json.env : "");
              resultEl.innerHTML = ' <span class="icon warn">' + escapeHtml(reason + extra) + '</span>';
            }
          } catch (error) {
            if (resultEl) resultEl.innerHTML = ' <span class="icon warn">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</span>';
          }
        }));
      });

      document.querySelectorAll("a[href*='/preview']").forEach((link) => {
        const href = link.getAttribute("href") || "";
        const match = href.match(/\\/ops\\/review-queue\\/([^\\/]+)\\/preview/);
        if (!match) return;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openPreviewDrawer(match[1]);
        });
      });

      document.querySelectorAll("[data-run-drawer]").forEach((row) => {
        row.addEventListener("click", (event) => {
          // Avoid double-trigger on nested links/buttons inside the row.
          const tagName = (event.target?.tagName || "").toLowerCase();
          if (tagName === "a" || tagName === "button" || tagName === "select") return;
          const id = row.getAttribute("data-run-drawer");
          if (id) openRunDrawer(id);
        });
      });

      document.querySelectorAll("[data-schedule-drawer]").forEach((row) => {
        row.addEventListener("click", (event) => {
          const tagName = (event.target?.tagName || "").toLowerCase();
          if (tagName === "a" || tagName === "button" || tagName === "select") return;
          const id = row.getAttribute("data-schedule-drawer");
          if (id) openScheduleDrawer(id);
        });
      });

      document.querySelectorAll("[data-topic-drawer]").forEach((row) => {
        row.addEventListener("click", (event) => {
          const tagName = (event.target?.tagName || "").toLowerCase();
          if (tagName === "a" || tagName === "button" || tagName === "select") return;
          const id = row.getAttribute("data-topic-drawer");
          if (id) navigateTo("/ops/topics/" + encodeURIComponent(id));
        });
      });

      // Auto-refresh when an in-progress run is visible on the current tab.
      // 5s polling is good enough for current run durations (≈30s).
      const hasRunning = !!document.querySelector("tr[data-run-status='running']");
      if (hasRunning && !window.__opsAutoRefreshTimer) {
        window.__opsAutoRefreshTimer = setInterval(() => {
          // Skip if drawer is open (the user is reading something focused)
          const drawerEl = document.getElementById("review-drawer");
          if (drawerEl && !drawerEl.classList.contains("hidden")) return;
          refreshCurrentTab();
        }, 5000);
      }
    }

    bindContentHandlers();
  `;
}

function renderSchedules(overview: OpsOverview): string {
  const schedules = overview.schedules;
  return `<div class="ops-actions">
    ${schedules.length === 0 ? `<div class="empty">No schedules yet. Use the New Run form above (set Mode to "Recurring") to create one.</div>` : `<table>
      <thead><tr><th>Schedule</th><th>Action</th><th>Topic / Providers</th><th>Frequency</th><th>Next Run</th><th>Last Run</th><th>Status</th></tr></thead>
      <tbody>${schedules.map((s) => `<tr class="clickable" data-schedule-drawer="${h(s.id)}">
        <td><b class="mono" title="${h(s.id)}">${h(shortenId(s.id))}</b><div class="muted">created ${h(relativeTime(s.createdAt))}</div></td>
        <td>${tag(s.action)}${s.dryRun ? tag("dry-run") : ""}</td>
        <td><span class="mono">${h(s.topicId)}</span><div class="muted">${s.providers.map(h).join(", ")}</div></td>
        <td title="${h(s.cron)}">${h(humanizeCron(s.cron, s.timezone))}</td>
        <td class="muted" title="${h(s.nextRunAt)}">${h(relativeTime(s.nextRunAt))}</td>
        <td>${s.lastRunAt ? `${s.lastRunStatus ? tag(s.lastRunStatus) : ""}<div class="muted" title="${h(s.lastRunAt)}">${h(relativeTime(s.lastRunAt))}</div>` : `<span class="muted">never</span>`}</td>
        <td>${tag(s.status)}</td>
      </tr>`).join("")}</tbody>
    </table>`}
    <div id="ops-schedule-result" class="empty" style="margin-top:12px">Click a row to open schedule controls.</div>
  </div>`;
}

function renderTabNav(initialTab: string): string {
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "topics", label: "Topics" },
    { id: "collection", label: "Collection" },
    { id: "review", label: "Review &amp; Handoff" },
    { id: "system", label: "System" },
  ];
  return `<nav class="ops-tabs">
    ${tabs.map((t) => `<a class="tab${t.id === initialTab ? " active" : ""}" data-tab="${t.id}" href="/ops/${t.id}">${t.label}</a>`).join("")}
  </nav>`;
}

function renderDashboard(overview: OpsOverview): string {
  const failedSchedules = overview.schedules.filter((s) => s.lastRunStatus === "failed");
  const pendingReviews = overview.reviewQueue.filter((item) => item.status === "pending");
  const missingEnvProviders = overview.providers.filter((p) => p.envState === "missing");
  return `<section class="cards dashboard-cards">
    ${metricCard("Pending Review", overview.summary.pendingReviewCount, "items to audit")}
    ${metricCard("Active Schedules", overview.summary.activeScheduleCount, `${overview.schedules.length} total`)}
    ${metricCard("Failed (last run)", failedSchedules.length, "needs attention")}
    ${metricCard("Evidence Total", overview.summary.normalizedEvidenceCount, `${overview.summary.topicsWithHandoff} topics with handoff`)}
  </section>

  <section class="grid two">
    <article class="panel">
      <div class="panel-head"><h2>Needs Attention</h2><span>${pendingReviews.length + failedSchedules.length + missingEnvProviders.length} items</span></div>
      ${renderNeedsAttention(pendingReviews, failedSchedules, missingEnvProviders)}
    </article>
    <article class="panel">
      <div class="panel-head"><h2>Recent Activity</h2><span>last ${Math.min(12, overview.recentOpsRuns.length)} runs</span></div>
      ${renderActivityTimeline(overview)}
    </article>
  </section>`;
}

function renderNeedsAttention(pending: OpsReviewItem[], failedSchedules: OpsOverview["schedules"], missingEnv: OpsOverview["providers"]): string {
  const items: string[] = [];
  pending.slice(0, 5).forEach((item) => {
    items.push(`<li><span class="tag warn">review</span> <b>${h(item.topicId)}</b> · ${item.normalizedEvidenceCount} ev · <a href="/ops/review-queue/${h(item.id)}/preview" target="_blank">Preview</a></li>`);
  });
  failedSchedules.slice(0, 5).forEach((s) => {
    items.push(`<li><span class="tag warn">schedule</span> <b>${h(s.id)}</b> failed · ${s.lastRunId ? `<a href="/ops/runs/${h(s.lastRunId)}/view">last run</a>` : "no runId"}</li>`);
  });
  missingEnv.forEach((p) => {
    items.push(`<li><span class="tag warn">provider</span> <b>${h(p.id)}</b> missing env: <code>${p.envRequired.map(h).join(", ")}</code></li>`);
  });
  if (items.length === 0) return `<div class="empty ok">Nothing needs attention right now.</div>`;
  return `<ul class="needs-attention">${items.join("")}</ul>`;
}

function renderActivityTimeline(overview: OpsOverview): string {
  const runs = overview.recentOpsRuns.slice(0, 12);
  if (runs.length === 0) return `<div class="empty">No recent activity. Trigger a run from Collection or wait for a schedule to fire.</div>`;
  return `<ul class="activity-timeline">${runs.map((run) => `<li>
    <span class="mono">${h(run.endedAt || run.startedAt)}</span>
    <span class="tag">${h(run.action)}</span>
    ${tag(run.status)}
    <b>${h(run.topicId)}</b>
    <span class="muted">${run.rawRecordCount} raw / ${run.normalizedEvidenceCount} ev</span>
    <a href="/ops/runs/${h(run.runId)}/view" class="muted">open</a>
  </li>`).join("")}</ul>`;
}

function renderHandoffFiles(overview: OpsOverview): string {
  const topics = overview.topics.filter((topic) => topic.artifacts.gameLensHandoffExists || topic.artifacts.normalizedExists);
  if (topics.length === 0) return `<div class="empty">No topics have a normalized or handoff file yet. Run collect-and-normalize from Collection to create them.</div>`;
  return `<table>
    <thead><tr><th>Topic</th><th>Files</th><th>Counts</th><th>Last Updated</th></tr></thead>
    <tbody>${topics.map((topic) => `<tr>
      <td><b>${h(topic.name)}</b><div class="mono">${h(topic.id)}</div></td>
      <td>
        <span class="icon ${topic.artifacts.gameLensHandoffExists ? "ok" : "off"}" title="${h(topic.artifacts.gameLensHandoffPath || "missing")}">${topic.artifacts.gameLensHandoffExists ? "✓" : "✗"} handoff</span>
        <span class="icon ${topic.artifacts.normalizedExists ? "ok" : "off"}" title="${h(topic.artifacts.normalizedPath || "missing")}">${topic.artifacts.normalizedExists ? "✓" : "✗"} normalized</span>
        <span class="icon ${topic.artifacts.reportExists ? "ok" : "off"}" title="${h(topic.artifacts.reportPath || "missing")}">${topic.artifacts.reportExists ? "✓" : "✗"} report</span>
      </td>
      <td><div>${topic.artifacts.gameLensEvidenceCount} gamelens</div><div class="muted">${topic.artifacts.normalizedRecordCount} normalized</div></td>
      <td class="muted" title="${h(topic.artifacts.lastRawUpdatedAt || topic.artifacts.reportUpdatedAt || "")}">${h(relativeTime(topic.artifacts.lastRawUpdatedAt || topic.artifacts.reportUpdatedAt || ""))}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

export function renderTopicDetailPage(topic: OpsOverview["topics"][number], overview: OpsOverview): string {
  const collectable = new Set(["steam", "youtube", "reddit"]);
  const topicSchedules = overview.schedules.filter((s) => s.topicId === topic.id);
  const topicRuns = overview.recentOpsRuns.filter((r) => r.topicId === topic.id).slice(0, 20);
  const topicReviews = overview.reviewQueue.filter((r) => r.topicId === topic.id && r.status === "pending");
  const channels = topic.dataSources.map((src) => {
    const provider = overview.providers.find((p) => p.id === src);
    const lastRun = topicRuns.find((r) => r.providers.includes(src));
    return {
      id: src,
      enabled: collectable.has(src),
      envState: provider?.envState || "unknown",
      lastRunStatus: lastRun?.status || "",
      lastRunAt: lastRun?.endedAt || lastRun?.startedAt || "",
      label: provider?.label || src,
      notes: provider?.notes || "",
    };
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${h(topic.name)} — Scout Ops</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow"><a href="/ops/topics" style="color:#e1b083">Topics</a> ›</p>
        <h1>${h(topic.name)}</h1>
        <p class="lede">${h(topic.description || "No description.")}</p>
        <div class="muted" style="color:#d4c9b8;margin-top:8px">
          ${tag(topic.status)}${tag(topic.priority)}${tag(topic.intent)}
          <span class="mono">${h(topic.id)}</span>
          ${topic.projectId ? ` · ${tag(topic.projectId)}` : ""}
          · ${h(topic.vertical)} / ${h(topic.market || "?")} / ${h(topic.language || "?")}
          · owner ${h(topic.owner || "—")}
          · cadence ${h(topic.refreshCadence || "—")}
        </div>
      </div>
      <div class="hero-actions">
        <button type="button" data-topic-runnow='${h(JSON.stringify({
          topicId: topic.id,
          projectId: topic.projectId,
          name: topic.name,
          providers: channels.filter((c) => c.enabled && c.envState !== "missing").map((c) => c.id),
        }))}'>Run Now</button>
        <a class="pill" href="/ops/topics">← Topics</a>
        <a class="pill" href="/ops/collection">Open Collection</a>
      </div>
    </section>

    <section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Channels</h2><span>${channels.filter((c) => c.envState !== "missing").length}/${channels.length} ready</span></div>
        ${channels.length === 0 ? `<div class="empty">No data sources configured for this topic.</div>` : `<table>
          <thead><tr><th>Channel</th><th>Status</th><th>Last Run</th></tr></thead>
          <tbody>${channels.map((c) => `<tr>
            <td><b>${h(c.id)}</b><div class="muted">${h(c.label)}</div></td>
            <td>
              ${c.envState === "missing" ? `<span class="icon warn">missing env</span>` : ""}
              ${!c.enabled ? `<span class="icon off">not in SO2 allowlist</span>` : ""}
              ${c.enabled && c.envState !== "missing" ? `<span class="icon ok">ready</span>` : ""}
            </td>
            <td>${c.lastRunStatus ? `${tag(c.lastRunStatus)}<div class="muted" title="${h(c.lastRunAt)}">${h(relativeTime(c.lastRunAt))}</div>` : `<span class="muted">never</span>`}</td>
          </tr>`).join("")}</tbody>
        </table>`}
      </article>

      <article class="panel">
        <div class="panel-head"><h2>Schedules</h2><span>${topicSchedules.length} total, ${topicSchedules.filter((s) => s.status === "active").length} active</span></div>
        ${topicSchedules.length === 0 ? `<div class="empty">No schedules. Use <a href="/ops/collection">Collection</a> to create one for this topic.</div>` : `<table>
          <thead><tr><th>Schedule</th><th>Frequency</th><th>Next</th><th>Status</th></tr></thead>
          <tbody>${topicSchedules.map((s) => `<tr class="clickable" data-schedule-drawer="${h(s.id)}">
            <td><span class="mono" title="${h(s.id)}">${h(shortenId(s.id))}</span></td>
            <td title="${h(s.cron)}">${h(humanizeCron(s.cron, s.timezone))}</td>
            <td class="muted" title="${h(s.nextRunAt)}">${h(relativeTime(s.nextRunAt))}</td>
            <td>${tag(s.status)}</td>
          </tr>`).join("")}</tbody>
        </table>`}
      </article>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Recent Runs</h2><span>${topicRuns.length} for this topic</span></div>
      ${topicRuns.length === 0 ? `<div class="empty">No runs for this topic yet.</div>` : `<table>
        <thead><tr><th>When</th><th>Run</th><th>Action</th><th>Status</th><th>Counts</th></tr></thead>
        <tbody>${topicRuns.map((r) => `<tr class="clickable" data-run-drawer="${h(r.runId)}">
          <td class="muted" title="${h(r.endedAt || r.startedAt)}">${h(relativeTime(r.endedAt || r.startedAt))}</td>
          <td><span class="mono" title="${h(r.runId)}">${h(shortenId(r.runId))}</span></td>
          <td>${tag(r.action)}</td>
          <td>${tag(r.status)}</td>
          <td>${r.rawRecordCount} raw / ${r.normalizedEvidenceCount} ev</td>
        </tr>`).join("")}</tbody>
      </table>`}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Pending Reviews</h2><span>${topicReviews.length} for this topic</span></div>
      ${topicReviews.length === 0 ? `<div class="empty ok">No pending reviews.</div>` : `<table>
        <thead><tr><th>Review</th><th>Evidence</th><th>Created</th><th></th></tr></thead>
        <tbody>${topicReviews.map((item) => `<tr>
          <td><span class="mono" title="${h(item.id)}">${h(shortenId(item.id))}</span></td>
          <td>${item.normalizedEvidenceCount} ev</td>
          <td class="muted" title="${h(item.createdAt)}">${h(relativeTime(item.createdAt))}</td>
          <td><a href="/ops/review-queue/${h(item.id)}/preview" class="pill">Preview</a></td>
        </tr>`).join("")}</tbody>
      </table>`}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Artifacts</h2><span>files exist for this topic</span></div>
      <table>
        <thead><tr><th>File</th><th>Status</th><th>Count</th><th>Updated</th></tr></thead>
        <tbody>
          <tr><td><b>normalized evidence</b></td>
            <td><span class="icon ${topic.artifacts.normalizedExists ? "ok" : "off"}" title="${h(topic.artifacts.normalizedPath)}">${topic.artifacts.normalizedExists ? "✓ exists" : "✗ missing"}</span></td>
            <td>${topic.artifacts.normalizedRecordCount} rows</td>
            <td class="muted"></td></tr>
          <tr><td><b>gamelens handoff</b></td>
            <td><span class="icon ${topic.artifacts.gameLensHandoffExists ? "ok" : "off"}" title="${h(topic.artifacts.gameLensHandoffPath)}">${topic.artifacts.gameLensHandoffExists ? "✓ exists" : "✗ missing"}</span></td>
            <td>${topic.artifacts.gameLensEvidenceCount} items</td>
            <td class="muted"></td></tr>
          <tr><td><b>report markdown</b></td>
            <td><span class="icon ${topic.artifacts.reportExists ? "ok" : "off"}" title="${h(topic.artifacts.reportPath)}">${topic.artifacts.reportExists ? "✓ exists" : "✗ missing"}</span></td>
            <td></td>
            <td class="muted" title="${h(topic.artifacts.reportUpdatedAt || "")}">${h(relativeTime(topic.artifacts.reportUpdatedAt || ""))}</td></tr>
          <tr><td><b>raw files</b></td>
            <td>${topic.artifacts.rawFileCount > 0 ? `<span class="icon ok">${topic.artifacts.rawFileCount} files</span>` : `<span class="icon off">none</span>`}</td>
            <td>${topic.artifacts.rawRecordCount} records</td>
            <td class="muted" title="${h(topic.artifacts.lastRawUpdatedAt || "")}">${h(relativeTime(topic.artifacts.lastRawUpdatedAt || ""))}</td></tr>
        </tbody>
      </table>
      <details style="margin-top:14px"><summary>Full paths (hover icons above for short tooltip)</summary>
        <table class="kv" style="margin-top:8px">
          ${kv("normalized", topic.artifacts.normalizedPath || "—")}
          ${kv("handoff", topic.artifacts.gameLensHandoffPath || "—")}
          ${kv("report", topic.artifacts.reportPath || "—")}
          ${kv("topic dir", topic.artifacts.topicDir || "—")}
        </table>
      </details>
    </section>
  </main>
  <aside id="review-drawer" class="review-drawer hidden" aria-hidden="true">
    <div class="drawer-overlay" data-drawer-close></div>
    <div class="drawer-panel">
      <header class="drawer-head">
        <h3 id="drawer-title">Details</h3>
        <button type="button" data-drawer-close class="pill secondary">Close</button>
      </header>
      <div id="drawer-body" class="drawer-body"></div>
      <footer id="drawer-actions" class="drawer-actions"></footer>
    </div>
  </aside>
  <script>${clientScript()}</script>
</body>
</html>`;
}

export function renderRunDetailPage(run: Record<string, unknown>): string {
  const stringField = (key: string): string => {
    const value = run[key];
    return typeof value === "string" ? value : "";
  };
  const numberField = (key: string): number => {
    const value = run[key];
    return typeof value === "number" ? value : 0;
  };
  const arrayField = (key: string): string[] => {
    const value = run[key];
    return Array.isArray(value) ? value.map(String) : [];
  };
  const commandResults = Array.isArray(run.commandResults) ? run.commandResults as Array<Record<string, unknown>> : [];
  const runId = stringField("runId");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Run ${h(runId)} — Scout Ops</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Scout Ops Run</p>
        <h1>${h(runId)}</h1>
        <p class="lede">${h(stringField("action"))} · ${tag(stringField("status"))} · topic ${h(stringField("topicId"))}</p>
      </div>
      <div class="hero-actions">
        <a class="pill" href="/ops">← Back to Ops</a>
        <a class="pill" href="/ops/runs/${encodeURIComponent(runId)}/logs">Logs JSON</a>
        <a class="pill" href="/ops/runs/${encodeURIComponent(runId)}">Raw JSON</a>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Summary</h2></div>
      <table class="kv">
        ${kv("action", stringField("action"))}
        ${kv("status", stringField("status"))}
        ${kv("topicId", stringField("topicId"))}
        ${kv("projectId", stringField("projectId"))}
        ${kv("providers", arrayField("providers").join(", "))}
        ${kv("dryRun", String(run.dryRun ?? false))}
        ${kv("startedAt", stringField("startedAt"))}
        ${kv("endedAt", stringField("endedAt"))}
        ${kv("rawRecordCount", String(numberField("rawRecordCount")))}
        ${kv("normalizedEvidenceCount", String(numberField("normalizedEvidenceCount")))}
        ${kv("commandCount", String(numberField("commandCount")))}
        ${kv("successfulCommandCount", String(numberField("successfulCommandCount")))}
        ${kv("failedCommandCount", String(numberField("failedCommandCount")))}
        ${kv("runDir", stringField("runDir"))}
      </table>
    </section>

    ${stringField("errorText") ? `<section class="panel">
      <div class="panel-head"><h2>Error</h2></div>
      <div class="empty warn">${h(stringField("errorText"))}</div>
    </section>` : ""}

    <section class="panel">
      <div class="panel-head"><h2>Commands</h2><span>${commandResults.length} steps</span></div>
      ${commandResults.length === 0 ? `<div class="empty">No command results recorded.</div>` : `<table>
        <thead><tr><th>Label</th><th>Exit</th><th>TimedOut</th><th>Stdout (parsed)</th><th>Stderr</th></tr></thead>
        <tbody>${commandResults.map((cmd) => `<tr>
          <td><b>${h(String(cmd.label || ""))}</b><div class="mono">${h(String(cmd.command || "").slice(0, 200))}</div></td>
          <td>${tag(String(cmd.exitCode ?? ""))}</td>
          <td>${tag(String(cmd.timedOut ?? false))}</td>
          <td><pre class="mono">${h(cmd.parsed ? JSON.stringify(cmd.parsed, null, 2).slice(0, 800) : String(cmd.stdout || "").slice(0, 500))}</pre></td>
          <td><pre class="mono">${h(String(cmd.stderr || "").slice(0, 500))}</pre></td>
        </tr>`).join("")}</tbody>
      </table>`}
    </section>
  </main>
</body>
</html>`;
}

export function renderReviewPreviewPage(preview: { item: OpsReviewItem; normalizedSample: Array<Record<string, unknown>>; handoff: Record<string, unknown> | null }): string {
  const { item, normalizedSample, handoff } = preview;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Review ${h(item.id)} — Scout Ops</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Review Preview</p>
        <h1>${h(item.id)}</h1>
        <p class="lede">${tag(item.status)} · topic ${h(item.topicId)} · ${h(item.providers.join(", "))} · ${item.normalizedEvidenceCount} evidence rows</p>
      </div>
      <div class="hero-actions">
        <a class="pill" href="/ops">← Back to Ops</a>
        <a class="pill" href="/ops/runs/${encodeURIComponent(item.runId)}/view">Open Run</a>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Metadata</h2></div>
      <table class="kv">
        ${kv("id", item.id)}
        ${kv("status", item.status)}
        ${kv("runId", item.runId)}
        ${kv("topicId", item.topicId)}
        ${kv("projectId", item.projectId)}
        ${kv("vertical", item.vertical)}
        ${kv("providers", item.providers.join(", "))}
        ${kv("dryRun", String(item.dryRun))}
        ${kv("createdAt", item.createdAt)}
        ${kv("updatedAt", item.updatedAt)}
        ${kv("rawRecordCount", String(item.rawRecordCount))}
        ${kv("normalizedEvidenceCount", String(item.normalizedEvidenceCount))}
        ${kv("normalizedPath", item.normalizedPath)}
        ${kv("handoffPath", item.handoffPath)}
        ${kv("reportPath", item.reportPath)}
        ${item.reviewer ? kv("reviewer", item.reviewer) : ""}
        ${item.decisionNote ? kv("decisionNote", item.decisionNote) : ""}
      </table>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Normalized Sample</h2><span>${normalizedSample.length} of first 10 rows</span></div>
      ${normalizedSample.length === 0 ? `<div class="empty warn">No normalized records readable. Check normalizedPath.</div>` : `<table>
        <thead><tr><th>Source</th><th>SourceItemId</th><th>Title</th><th>Snippet</th><th>URL</th></tr></thead>
        <tbody>${normalizedSample.map((row) => `<tr>
          <td>${tag(String(row.source || row.platform || "?"))}</td>
          <td class="mono">${h(String(row.sourceItemId || row.id || ""))}</td>
          <td>${h(String(row.title || row.headline || "").slice(0, 200))}</td>
          <td class="muted">${h(String(row.snippet || row.summary || row.text || "").slice(0, 300))}</td>
          <td class="mono">${h(String(row.sourceUrl || row.url || "").slice(0, 120))}</td>
        </tr>`).join("")}</tbody>
      </table>`}
    </section>

    ${handoff ? `<section class="panel">
      <div class="panel-head"><h2>Handoff</h2><span>${h(String(handoff.schema || "no schema"))}</span></div>
      <pre class="mono">${h(JSON.stringify(handoff, null, 2).slice(0, 2000))}</pre>
    </section>` : `<section class="panel">
      <div class="panel-head"><h2>Handoff</h2></div>
      <div class="empty">No handoff file at ${h(item.handoffPath || "n/a")}</div>
    </section>`}
  </main>
</body>
</html>`;
}

function styles(): string {
  return `
    :root { --bg:#101820; --paper:#f7f0df; --card:#fffaf0; --ink:#15211c; --muted:#67716d; --line:#d8ccb6; --accent:#c26235; --ok:#266f52; --warn:#a36400; --bad:#a73838; --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    * { box-sizing: border-box; }
    body { margin:0; background: radial-gradient(circle at 10% 0%, #244034 0, transparent 28%), linear-gradient(135deg, #101820, #1d2d28 52%, #3a2b20); color:var(--ink); font-family: Iowan Old Style, Palatino Linotype, Georgia, serif; }
    .page { max-width: 1480px; margin: 0 auto; padding: 28px 20px 64px; }
    .hero { display:flex; justify-content:space-between; gap:20px; align-items:flex-end; color:var(--paper); padding:28px 4px 24px; }
    .eyebrow { margin:0 0 8px; color:#e1b083; text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
    h1 { margin:0; font-size:54px; line-height:.95; letter-spacing:-.04em; }
    h2 { margin:0; font-size:20px; }
    .lede { max-width:780px; color:#d4c9b8; font-size:17px; line-height:1.5; }
    .hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .pill { color:var(--paper); border:1px solid rgba(255,255,255,.28); border-radius:999px; padding:9px 13px; text-decoration:none; background:rgba(255,255,255,.08); }
    .inline { margin-top:12px; }
    button { border:0; border-radius:999px; padding:10px 14px; color:#fffaf0; background:var(--accent); cursor:pointer; font:inherit; }
    button.secondary { background:#49635a; }
    button:hover { filter:brightness(.95); }
    label { display:grid; gap:6px; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    input,select { width:100%; border:1px solid var(--line); border-radius:12px; padding:10px 11px; background:#fff; color:var(--ink); font:14px var(--mono); }
    .ops-actions form { display:grid; gap:12px; }
    .provider-checks,.form-row { display:flex; gap:10px; flex-wrap:wrap; align-items:end; }
    .form-row label:not(.check) { flex:1 1 220px; }
    .check { display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:999px; padding:8px 10px; background:#fff; text-transform:none; letter-spacing:0; color:var(--ink); }
    .check input { width:auto; }
    .check.disabled { opacity:.55; }
    .check small { color:var(--warn); font-family:var(--mono); }
    .cards { display:grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap:14px; }
    .card,.panel { background:rgba(255,250,240,.96); border:1px solid var(--line); border-radius:20px; box-shadow:0 18px 40px rgba(0,0,0,.2); }
    .card { padding:18px; }
    .metric-label { color:var(--muted); text-transform:uppercase; letter-spacing:.08em; font-size:12px; }
    .metric-value { font-size:38px; margin:8px 0 6px; }
    .grid { display:grid; gap:14px; margin-top:14px; }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .panel { padding:18px; margin-top:14px; overflow:hidden; }
    .grid .panel { margin-top:0; }
    .panel-head { display:flex; justify-content:space-between; gap:12px; align-items:end; margin-bottom:12px; color:var(--muted); }
    .panel-head h2 { color:var(--ink); }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th,td { border-top:1px solid var(--line); padding:10px 8px; text-align:left; vertical-align:top; }
    th { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.07em; }
    .kv th { width:170px; }
    .tag { display:inline-block; border:1px solid var(--line); background:#fff; border-radius:999px; padding:4px 8px; margin:0 5px 5px 0; font-size:12px; white-space:nowrap; }
    .tag.ok { color:var(--ok); border-color:rgba(38,111,82,.28); }
    .tag.warn { color:var(--warn); border-color:rgba(163,100,0,.28); }
    .mono { font-family:var(--mono); font-size:12px; word-break:break-all; }
    .muted { color:var(--muted); font-size:13px; line-height:1.4; }
    .empty { padding:14px; border:1px dashed var(--line); border-radius:14px; color:var(--muted); }
    .empty.ok { color:var(--ok); border-color:rgba(38,111,82,.32); }
    .empty.warn { color:var(--warn); border-color:rgba(163,100,0,.32); }
    a { color:var(--accent); }
    .stack { display:grid; gap:10px; }
    .small { font-size:13px; }
    .alert { display:grid; gap:4px; padding:12px; border:1px solid var(--line); border-radius:14px; background:#fff; }
    .alert.warning { border-color:rgba(163,100,0,.35); color:var(--warn); }
    .notes { margin:0; padding-left:20px; color:var(--muted); line-height:1.7; }
    code { font-family:var(--mono); background:#fff; padding:2px 5px; border-radius:6px; }
    .ops-tabs { display:flex; gap:4px; margin:24px 0 16px; border-bottom:1px solid rgba(255,255,255,.18); }
    .ops-tabs .tab { background:transparent; color:var(--paper); border:1px solid transparent; border-bottom:none; border-radius:14px 14px 0 0; padding:11px 18px; cursor:pointer; font:inherit; font-size:14px; letter-spacing:.02em; text-decoration:none; display:inline-block; }
    .ops-tabs .tab:hover { background:rgba(255,255,255,.06); }
    .ops-tabs .tab.active { background:var(--paper); color:var(--ink); border-color:var(--line); font-weight:600; }
    .tab-body { display:block; }
    .tab-body.hidden { display:none; }
    .topic-details.hidden { display:none; }
    .runs-filter { width:auto !important; padding:8px 10px !important; font-size:12px !important; }
    .icon { display:inline-block; padding:2px 8px; margin:0 4px 4px 0; border-radius:6px; font-size:12px; font-family:var(--mono); }
    .icon.ok { background:rgba(38,111,82,.12); color:var(--ok); border:1px solid rgba(38,111,82,.28); }
    .icon.off { background:rgba(120,120,120,.08); color:var(--muted); border:1px solid rgba(120,120,120,.18); }
    .icon.warn { background:rgba(163,100,0,.10); color:var(--warn); border:1px solid rgba(163,100,0,.28); }
    tr.clickable { cursor:pointer; }
    tr.clickable:hover { background:rgba(0,0,0,.03); }
    .step-strip { display:inline-flex; gap:4px; align-items:center; }
    .step-strip .step { width:8px; height:8px; border-radius:50%; background:rgba(0,0,0,.15); }
    .step-strip .step.active { background:var(--accent); }
    .step-strip .step.done { background:var(--ok); }
    .step-strip .step.error { background:var(--bad); }
    .dashboard-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .needs-attention, .activity-timeline { margin:0; padding-left:18px; line-height:1.7; }
    .needs-attention li, .activity-timeline li { margin:6px 0; }
    .activity-timeline li { display:flex; flex-wrap:wrap; gap:8px; align-items:center; list-style:disc; }
    .review-drawer { position:fixed; inset:0; z-index:100; }
    .review-drawer.hidden { display:none; }
    .drawer-overlay { position:absolute; inset:0; background:rgba(15,25,22,.5); }
    .drawer-panel { position:absolute; right:0; top:0; bottom:0; width:min(720px, 92vw); background:#fffaf0; box-shadow:-10px 0 40px rgba(0,0,0,.3); display:flex; flex-direction:column; }
    .drawer-head { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--line); }
    .drawer-head h3 { margin:0; color:var(--ink); font-size:18px; }
    .drawer-body { flex:1; overflow-y:auto; padding:20px; }
    .drawer-actions { padding:16px 20px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end; align-items:center; }
    .pill.secondary { background:rgba(0,0,0,.08); border-color:rgba(0,0,0,.1); color:var(--ink); }
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } .two { grid-template-columns: 1fr; } .hero { display:block; } .dashboard-cards { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 680px) { .cards { grid-template-columns: repeat(2, 1fr); } h1 { font-size:42px; } table { font-size:12px; } }
  `;
}
