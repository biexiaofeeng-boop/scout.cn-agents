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
        <p class="lede">Readonly operator view for topic governance, provider readiness, runtime artifacts, hub health, and handoff outputs.</p>
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
      ${metricCard("Reports", overview.summary.topicsWithReport, "latest.md")}
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
      <div class="panel-head"><h2>Topics And Runtime Artifacts</h2><span>${h(overview.runtimeRoot)}</span></div>
      ${renderTopics(overview)}
    </section>

    <section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Recent Hub Runs</h2><span>${overview.recentRuns.length} rows</span></div>
        ${renderRuns(overview)}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Operator Notes</h2><span>SO1 readonly</span></div>
        <ul class="notes">
          <li>Use this page to verify topic readiness before running collection.</li>
          <li>SO1 intentionally has no write buttons. Collection actions are planned for SO2.</li>
          <li>Runtime artifacts live outside git under the configured Scout runtime root.</li>
          <li>YouTube remains disabled until <code>YOUTUBE_API_KEY</code> is configured.</li>
        </ul>
      </article>
    </section>
  </main>
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

function renderTopics(overview: OpsOverview): string {
  if (overview.topics.length === 0) return `<div class="empty warn">No topics loaded. Check topic config path: ${h(overview.topicConfigPath)}</div>`;
  return `<table>
    <thead><tr><th>Topic</th><th>Scope</th><th>Sources</th><th>Runtime</th><th>Artifacts</th></tr></thead>
    <tbody>
      ${overview.topics.map((topic) => `<tr>
        <td><b>${h(topic.name)}</b><div class="mono">${h(topic.id)}</div><div class="muted">${h(topic.description)}</div></td>
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
