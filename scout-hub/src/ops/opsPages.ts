import type { OpsArtifactState, OpsOverview } from "./types.js";

export function renderOpsPage(overview: OpsOverview): string {
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
        <p class="lede">Operator view for topic governance, provider readiness, controlled collection actions, runtime artifacts, hub health, and handoff outputs.</p>
      </div>
      <div class="hero-actions">
        <a class="pill" href="/ops/overview.json">Open JSON</a>
        <a class="pill" href="/health">Health</a>
        <a class="pill" href="/alerts">Alerts</a>
      </div>
    </section>

    <section class="cards">
      ${metricCard("Topics", overview.summary.topicCount, `${overview.summary.activeTopicCount} active`)}
      ${metricCard("Providers", overview.summary.providerCount, `${overview.summary.readyProviderCount} ready`)}
      ${metricCard("Raw Records", overview.summary.rawRecordCount, "runtime files")}
      ${metricCard("Evidence", overview.summary.normalizedEvidenceCount, "normalized rows")}
      ${metricCard("Handoff", overview.summary.topicsWithHandoff, "topics ready")}
      ${metricCard("Review", overview.summary.pendingReviewCount, "pending")}
    </section>

    <section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Hub Health</h2><span>${h(overview.generatedAt)}</span></div>
        ${renderHealth(overview)}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Alerts</h2><span>${overview.alerts.length} active</span></div>
        ${renderAlerts(overview)}
      </article>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Providers</h2><span>Secrets are never rendered</span></div>
      ${renderProviders(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Control Actions</h2><span>SO2 guarded execution</span></div>
      ${renderOpsActions(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Topics And Runtime Artifacts</h2><span>${h(overview.runtimeRoot)}</span></div>
      ${renderTopics(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Review Queue</h2><span>${overview.summary.pendingReviewCount} pending before schedule</span></div>
      ${renderReviewQueue(overview)}
    </section>

    <section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Recent Hub Runs</h2><span>${overview.recentRuns.length} rows</span></div>
        ${renderRuns(overview)}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Recent Ops Runs</h2><span>${overview.recentOpsRuns.length} rows</span></div>
        ${renderOpsRuns(overview)}
      </article>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Operator Notes</h2><span>SO2 first pass</span></div>
        <ul class="notes">
          <li>Use this page to verify topic readiness before running collection.</li>
      <li>SO2 actions only call allowlisted providers and known topics. No arbitrary shell command input is accepted.</li>
      <li>SO2.1 adds run cleanup, failed-run retry, and a review queue before scheduler editing.</li>
      <li>Runtime artifacts live outside git under the configured Scout runtime root.</li>
          <li>YouTube live collection remains disabled until <code>YOUTUBE_API_KEY</code> is configured. Dry-run can still be used for pipeline checks.</li>
        </ul>
    </section>
  </main>
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
  return `<table>
    <thead><tr><th>Provider</th><th>Status</th><th>Env</th><th>Verticals</th><th>Notes</th></tr></thead>
    <tbody>
      ${overview.providers.map((provider) => `<tr>
        <td><b>${h(provider.label)}</b><div class="mono">${h(provider.id)} / ${h(provider.kind)}</div></td>
        <td>${tag(provider.status)}</td>
        <td>${tag(provider.envState)}${provider.envRequired.length ? `<div class="mono">${provider.envRequired.map(h).join(", ")}</div>` : ""}</td>
        <td>${provider.verticals.map(tag).join("")}</td>
        <td>${h(provider.notes)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderOpsActions(overview: OpsOverview): string {
  const collectable = new Set(["steam", "youtube", "reddit"]);
  const activeTopics = overview.topics.filter((topic) => topic.status === "active");
  const providers = overview.providers.filter((provider) => collectable.has(provider.id));
  return `<div class="ops-actions">
    <form id="ops-action-form">
      <label>Topic
        <select name="topicId">
          ${activeTopics.map((topic) => `<option value="${h(topic.id)}" data-query="${h(topic.name)}">${h(topic.name)} / ${h(topic.id)}</option>`).join("")}
        </select>
      </label>
      <label>Query
        <input name="query" value="${h(activeTopics[0]?.name || "")}" placeholder="Default uses selected topic name" />
      </label>
      <label>Limit
        <input name="limit" type="number" min="1" max="25" value="10" />
      </label>
      <div class="provider-checks">
        ${providers.map((provider) => {
          const missing = provider.envState === "missing";
          const disabled = missing ? "disabled" : "";
          return `<label class="check ${missing ? "disabled" : ""}">
            <input type="checkbox" name="providers" value="${h(provider.id)}" ${provider.id === "steam" || provider.id === "reddit" ? "checked" : ""} ${disabled} />
            <span>${h(provider.id)}</span>
            ${missing ? `<small>missing env</small>` : ""}
          </label>`;
        }).join("")}
      </div>
      <div class="form-row">
        <label class="check"><input type="checkbox" name="dryRun" /> <span>dry-run</span></label>
        <label class="check"><input type="checkbox" name="includeDryRun" /> <span>include dry-run in normalize</span></label>
      </div>
      <div class="form-row">
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
      <div class="hero-actions inline">
        <button type="button" data-action="collect-topic">Collect Topic</button>
        <button type="button" data-action="normalize-topic">Normalize Topic</button>
        <button type="button" data-action="collect-and-normalize-topic">Collect + Normalize</button>
      </div>
    </form>
    <div id="ops-action-result" class="empty">Select a topic/provider and run a guarded action. Results are persisted under ${h(overview.runtimeRoot)}/runs.</div>
  </div>`;
}

function renderReviewQueue(overview: OpsOverview): string {
  if (overview.reviewQueue.length === 0) return `<div class="empty">No review items yet. Run Normalize or Collect + Normalize to create review gates.</div>`;
  return `<table>
    <thead><tr><th>Review</th><th>Status</th><th>Topic</th><th>Evidence</th><th>Artifacts</th><th>Decision</th></tr></thead>
    <tbody>${overview.reviewQueue.map((item) => `<tr>
      <td><b>${h(item.id)}</b><div class="mono">${h(item.runId)}</div><div class="muted">${h(item.createdAt)}</div></td>
      <td>${tag(item.status)}${item.reviewer ? `<div class="muted">by ${h(item.reviewer)}</div>` : ""}</td>
      <td><div class="mono">${h(item.topicId)}</div>${item.projectId ? tag(item.projectId) : ""}<div>${item.providers.map(tag).join("")}</div></td>
      <td>${item.rawRecordCount} raw / ${item.normalizedEvidenceCount} ev${item.dryRun ? `<div>${tag("dry-run")}</div>` : ""}</td>
      <td><div class="stack small">
        <div><b>report</b><div class="mono">${h(item.reportPath)}</div></div>
        <div><b>handoff</b><div class="mono">${h(item.handoffPath || "n/a")}</div></div>
      </div></td>
      <td>
        ${item.status === "pending" ? `<div class="hero-actions inline">
          <button type="button" data-review="${h(item.id)}" data-status="approved">Approve</button>
          <button type="button" data-review="${h(item.id)}" data-status="rejected" class="secondary">Reject</button>
        </div>` : `<div class="muted">${h(item.decisionNote || "decided")}</div>`}
      </td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function renderTopics(overview: OpsOverview): string {
  if (overview.topics.length === 0) return `<div class="empty warn">No topics loaded. Check topic config path: ${h(overview.topicConfigPath)}</div>`;
  return `<table>
    <thead><tr><th>Topic</th><th>Scope</th><th>Sources</th><th>Runtime</th><th>Artifacts</th></tr></thead>
    <tbody>
      ${overview.topics.map((topic) => `<tr>
        <td><b>${h(topic.name)}</b><div class="mono">${h(topic.id)}</div>${topic.projectId ? `<div>${tag(topic.projectId)}</div>` : ""}<div class="muted">${h(topic.description)}</div></td>
        <td>${tag(topic.status)}${tag(topic.priority)}${tag(topic.intent)}<div class="mono">${h(topic.vertical)} / ${h(topic.market)} / ${h(topic.language)}</div><div class="muted">owner: ${h(topic.owner)} · cadence: ${h(topic.refreshCadence)}</div></td>
        <td><div>${topic.dataSources.map(tag).join("")}</div><div class="muted">platforms: ${topic.platforms.map(h).join(", ")}</div><div class="muted">seeds: ${topic.seedKeywordIds.map(h).join(", ")}</div></td>
        <td>${renderArtifactStats(topic.artifacts)}</td>
        <td>${renderArtifactLinks(topic.artifacts)}</td>
      </tr>`).join("")}
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
  if (overview.recentOpsRuns.length === 0) {
    return `<div class="stack">
      <div class="hero-actions inline"><button type="button" data-cleanup-runs="true" class="secondary">Cleanup Runs</button></div>
      <div class="empty">No ops action runs yet.</div>
    </div>`;
  }
  return `<div class="stack">
    <div class="hero-actions inline"><button type="button" data-cleanup-runs="true" class="secondary">Cleanup Runs</button></div>
    <table>
    <thead><tr><th>Run</th><th>Action</th><th>Status</th><th>Topic</th><th>Evidence</th><th>Ended</th><th>Action</th></tr></thead>
    <tbody>${overview.recentOpsRuns.map((run) => `<tr>
      <td class="mono"><a href="/ops/runs/${h(run.runId)}">${h(run.runId)}</a></td>
      <td>${tag(run.action)}</td>
      <td>${tag(run.status)}</td>
      <td><div class="mono">${h(run.topicId)}</div>${run.projectId ? tag(run.projectId) : ""}<div class="muted">${run.providers.map(h).join(", ")}</div></td>
      <td>${run.rawRecordCount} raw / ${run.normalizedEvidenceCount} ev</td>
      <td>${h(run.endedAt)}</td>
      <td>${run.status === "success" ? "" : `<button type="button" data-retry-run="${h(run.runId)}">Retry</button>`}</td>
    </tr>`).join("")}</tbody>
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

function clientScript(): string {
  return `
    const form = document.getElementById("ops-action-form");
    const resultBox = document.getElementById("ops-action-result");
    const topicSelect = form?.querySelector("select[name=topicId]");
    topicSelect?.addEventListener("change", () => {
      const option = topicSelect.selectedOptions[0];
      const query = form.querySelector("input[name=query]");
      if (query && option?.dataset?.query) query.value = option.dataset.query;
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!form || !resultBox) return;
        const action = button.getAttribute("data-action");
        const data = new FormData(form);
        const payload = {
          topicId: String(data.get("topicId") || ""),
          query: String(data.get("query") || ""),
          limit: Number(data.get("limit") || 10),
          providers: data.getAll("providers").map(String),
          dryRun: data.get("dryRun") === "on",
          includeDryRun: data.get("includeDryRun") === "on",
          appId: String(data.get("appId") || ""),
          subreddit: String(data.get("subreddit") || ""),
          gameIds: String(data.get("gameIds") || ""),
        };
        resultBox.className = "empty";
        resultBox.textContent = "Running " + action + " ...";
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
            " · <a href=\\"/ops/runs/" + encodeURIComponent(json.runId) + "\\">open run.json</a>";
        } catch (error) {
          resultBox.className = "empty warn";
          resultBox.textContent = error instanceof Error ? error.message : String(error);
        }
      });
    });
    document.querySelectorAll("[data-retry-run]").forEach((button) => {
      button.addEventListener("click", async () => {
        const runId = button.getAttribute("data-retry-run");
        if (!runId || !resultBox) return;
        resultBox.className = "empty";
        resultBox.textContent = "Retrying " + runId + " ...";
        try {
          const response = await fetch("/ops/runs/" + encodeURIComponent(runId) + "/retry", { method: "POST" });
          const json = await response.json();
          if (!response.ok) throw new Error(json.message || json.error || "retry failed");
          resultBox.className = "empty ok";
          resultBox.innerHTML = "retry created <b>" + escapeHtml(json.runId) + "</b> · status=" + escapeHtml(json.status);
        } catch (error) {
          resultBox.className = "empty warn";
          resultBox.textContent = error instanceof Error ? error.message : String(error);
        }
      });
    });
    document.querySelectorAll("[data-cleanup-runs]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!resultBox) return;
        const response = await fetch("/ops/runs/cleanup", { method: "POST" });
        const json = await response.json();
        resultBox.className = response.ok ? "empty ok" : "empty warn";
        resultBox.textContent = response.ok
          ? "cleanup deleted=" + json.deletedCount + ", kept=" + json.keptCount
          : (json.message || json.error || "cleanup failed");
      });
    });
    document.querySelectorAll("[data-review]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!resultBox) return;
        const id = button.getAttribute("data-review");
        const status = button.getAttribute("data-status");
        const response = await fetch("/ops/review-queue/" + encodeURIComponent(id) + "/decision", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status, reviewer: "ops-ui" }),
        });
        const json = await response.json();
        resultBox.className = response.ok ? "empty ok" : "empty warn";
        resultBox.textContent = response.ok
          ? "review " + json.id + " -> " + json.status
          : (json.message || json.error || "review decision failed");
      });
    });
    function escapeHtml(value) {
      return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
    }
  `;
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
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } .two { grid-template-columns: 1fr; } .hero { display:block; } }
    @media (max-width: 680px) { .cards { grid-template-columns: repeat(2, 1fr); } h1 { font-size:42px; } table { font-size:12px; } }
  `;
}
