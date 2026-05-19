import type { OpsArtifactState, OpsOverview, OpsReviewItem } from "./types.js";

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

    ${overview.showPipelineViews ? `<section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Hub Health</h2><span>${h(overview.generatedAt)}</span></div>
        ${renderHealth(overview)}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Alerts</h2><span>${overview.alerts.length} active</span></div>
        ${renderAlerts(overview)}
      </article>
    </section>` : `<section class="panel">
      <div class="panel-head"><h2>Alerts</h2><span>${overview.alerts.length} active</span></div>
      ${renderAlerts(overview)}
    </section>`}

    <section class="panel">
      <div class="panel-head"><h2>Providers</h2><span>Secrets are never rendered</span></div>
      ${renderProviders(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Control Actions</h2><span>SO2 guarded execution</span></div>
      ${renderOpsActions(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Schedules</h2><span>${overview.schedules.length} total, ${overview.summary.activeScheduleCount} active</span></div>
      ${renderSchedules(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Topics And Runtime Artifacts</h2><span>${h(overview.runtimeRoot)}</span></div>
      ${renderTopics(overview)}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Review Queue</h2><span>${overview.summary.pendingReviewCount} pending before schedule</span></div>
      ${renderReviewQueue(overview)}
    </section>

    ${overview.showPipelineViews ? `<section class="grid two">
      <article class="panel">
        <div class="panel-head"><h2>Recent Hub Runs</h2><span>${overview.recentRuns.length} rows</span></div>
        ${renderRuns(overview)}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>Recent Ops Runs</h2><span>${overview.recentOpsRuns.length} rows</span></div>
        ${renderOpsRuns(overview)}
      </article>
    </section>` : `<section class="panel">
      <div class="panel-head"><h2>Recent Ops Runs</h2><span>${overview.recentOpsRuns.length} rows</span></div>
      ${renderOpsRuns(overview)}
    </section>`}

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
          ${activeTopics.map((topic) => `<option value="${h(topic.id)}" data-query="${h(topic.name)}" data-sources='${h(JSON.stringify(topic.dataSources))}'>${h(topic.name)} / ${h(topic.id)}</option>`).join("")}
        </select>
      </label>
      <label>Query
        <input name="query" value="${h(activeTopics[0]?.name || "")}" placeholder="Default uses selected topic name" />
      </label>
      <label>Limit
        <input name="limit" type="number" min="1" max="25" value="10" />
        <small class="muted">max 25 per run</small>
      </label>
      <div class="provider-checks">
        ${providers.map((provider) => {
          const missing = provider.envState === "missing";
          const disabled = missing ? "disabled" : "";
          const initialChecked = !missing && (activeTopics[0]?.dataSources.includes(provider.id) ?? false);
          return `<label class="check ${missing ? "disabled" : ""}">
            <input type="checkbox" name="providers" value="${h(provider.id)}" ${initialChecked ? "checked" : ""} ${disabled} />
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
        <div class="hero-actions inline">
          <a href="/ops/review-queue/${h(item.id)}/preview" target="_blank" class="pill">Preview</a>
          ${item.status === "pending" ? `<button type="button" data-review="${h(item.id)}" data-status="approved">Approve</button>
          <button type="button" data-review="${h(item.id)}" data-status="rejected" class="secondary">Reject</button>` : `<span class="muted">${h(item.decisionNote || "decided")}</span>`}
        </div>
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
      <td class="mono"><a href="/ops/runs/${h(run.runId)}/view">${h(run.runId)}</a></td>
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
    let previousTopicQuery = topicSelect?.selectedOptions[0]?.dataset?.query || "";

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

    function updateProviderDefaults(option) {
      if (!form || !option) return;
      let sources = [];
      try { sources = JSON.parse(option.dataset?.sources || "[]"); } catch (_) { sources = []; }
      const set = new Set(sources);
      form.querySelectorAll("input[name=providers]").forEach((checkbox) => {
        if (checkbox.disabled) return;
        checkbox.checked = set.has(checkbox.value);
      });
    }

    topicSelect?.addEventListener("change", () => {
      const option = topicSelect.selectedOptions[0];
      const queryInput = form?.querySelector("input[name=query]");
      const nextTopicQuery = option?.dataset?.query || "";
      if (queryInput) {
        if (!queryInput.value || queryInput.value === previousTopicQuery) {
          queryInput.value = nextTopicQuery;
        }
      }
      previousTopicQuery = nextTopicQuery;
      updateProviderDefaults(option);
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => withButtonLock(button, "Running…", async () => {
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
            " · <a href=\\"/ops/runs/" + encodeURIComponent(json.runId) + "/view\\">open run detail</a>";
        } catch (error) {
          resultBox.className = "empty warn";
          resultBox.textContent = error instanceof Error ? error.message : String(error);
        }
      }));
    });

    document.querySelectorAll("[data-retry-run]").forEach((button) => {
      button.addEventListener("click", () => withButtonLock(button, "Retrying…", async () => {
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
      }));
    });

    document.querySelectorAll("[data-cleanup-runs]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm("Cleanup will delete old run directories based on retention policy. Continue?")) return;
        withButtonLock(button, "Cleaning…", async () => {
          if (!resultBox) return;
          const response = await fetch("/ops/runs/cleanup", { method: "POST" });
          const json = await response.json();
          resultBox.className = response.ok ? "empty ok" : "empty warn";
          resultBox.textContent = response.ok
            ? "cleanup deleted=" + json.deletedCount + ", kept=" + json.keptCount
            : (json.message || json.error || "cleanup failed");
        });
      });
    });

    document.querySelectorAll("[data-review]").forEach((button) => {
      button.addEventListener("click", () => withButtonLock(button, "Saving…", async () => {
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
      }));
    });

    const scheduleResult = document.getElementById("ops-schedule-result");
    const scheduleForm = document.getElementById("ops-schedule-form");
    const frequencySelect = scheduleForm?.querySelector("select[name=frequency]");
    function updateFrequencyFields() {
      if (!scheduleForm) return;
      const value = frequencySelect?.value || "daily";
      scheduleForm.querySelectorAll("[data-freq-show]").forEach((label) => {
        label.style.display = (label.getAttribute("data-freq-show") === value) ? "" : "none";
      });
    }
    frequencySelect?.addEventListener("change", updateFrequencyFields);
    updateFrequencyFields();

    const scheduleTopicSelect = scheduleForm?.querySelector("select[name=topicId]");
    scheduleTopicSelect?.addEventListener("change", () => {
      const option = scheduleTopicSelect.selectedOptions[0];
      if (!option || !scheduleForm) return;
      let sources = [];
      try { sources = JSON.parse(option.dataset?.sources || "[]"); } catch (_) { sources = []; }
      const set = new Set(sources);
      scheduleForm.querySelectorAll("input[name=schedProviders]").forEach((checkbox) => {
        if (checkbox.disabled) return;
        checkbox.checked = set.has(checkbox.value);
      });
    });

    function buildCron(form) {
      const freq = form.querySelector("[name=frequency]")?.value || "daily";
      const time = form.querySelector("[name=time]")?.value || "09:00";
      const [hhRaw, mmRaw] = time.split(":");
      const HH = Math.max(0, Math.min(23, parseInt(hhRaw, 10) || 0));
      const MM = Math.max(0, Math.min(59, parseInt(mmRaw, 10) || 0));
      if (freq === "daily") return MM + " " + HH + " * * *";
      if (freq === "weekly") {
        const wd = form.querySelector("[name=weekday]")?.value || "1";
        return MM + " " + HH + " * * " + wd;
      }
      if (freq === "hourly") return MM + " * * * *";
      if (freq === "every_n_hours") {
        const raw = form.querySelector("[name=everyNHours]")?.value || "6";
        const n = Math.max(1, Math.min(24, parseInt(raw, 10) || 6));
        return MM + " */" + n + " * * *";
      }
      return MM + " " + HH + " * * *";
    }

    document.querySelectorAll("[data-schedule-create]").forEach((button) => {
      button.addEventListener("click", () => withButtonLock(button, "Creating…", async () => {
        if (!scheduleForm || !scheduleResult) return;
        const data = new FormData(scheduleForm);
        const topicOption = scheduleTopicSelect?.selectedOptions[0];
        const payload = {
          topicId: String(data.get("topicId") || ""),
          projectId: String(topicOption?.dataset?.project || ""),
          providers: data.getAll("schedProviders").map(String),
          action: String(data.get("action") || "collect-and-normalize-topic"),
          query: String(data.get("schedQuery") || "").trim() || undefined,
          limit: Number(data.get("schedLimit") || 10),
          dryRun: data.get("schedDryRun") === "on",
          cron: buildCron(scheduleForm),
          timezone: String(data.get("timezone") || "Asia/Shanghai"),
        };
        scheduleResult.className = "empty";
        scheduleResult.textContent = "Creating schedule...";
        try {
          const response = await fetch("/ops/schedules", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await response.json();
          if (!response.ok) throw new Error(json.message || json.error || "create failed");
          scheduleResult.className = "empty ok";
          scheduleResult.textContent = "schedule " + json.id + " created · next run " + json.nextRunAt;
          setTimeout(() => window.location.reload(), 800);
        } catch (error) {
          scheduleResult.className = "empty warn";
          scheduleResult.textContent = error instanceof Error ? error.message : String(error);
        }
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
            setTimeout(() => window.location.reload(), 600);
          } catch (error) {
            scheduleResult.className = "empty warn";
            scheduleResult.textContent = error instanceof Error ? error.message : String(error);
          }
        });
      });
    });

    function escapeHtml(value) {
      return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
    }
  `;
}

function renderSchedules(overview: OpsOverview): string {
  const activeTopics = overview.topics.filter((topic) => topic.status === "active");
  const collectableSet = new Set(["steam", "youtube", "reddit"]);
  const collectableProviders = overview.providers.filter((provider) => collectableSet.has(provider.id));
  const schedules = overview.schedules;
  return `<div class="ops-actions">
    ${schedules.length === 0 ? `<div class="empty">No schedules yet. Use the form below to create one.</div>` : `<table>
      <thead><tr><th>Schedule</th><th>Action</th><th>Topic / Providers</th><th>Cron</th><th>Next Run</th><th>Last Run</th><th>Status</th><th>Controls</th></tr></thead>
      <tbody>${schedules.map((s) => `<tr>
        <td><b>${h(s.id)}</b><div class="muted">created ${h(s.createdAt)}</div></td>
        <td>${tag(s.action)}${s.dryRun ? tag("dry-run") : ""}</td>
        <td><div class="mono">${h(s.topicId)}</div>${s.projectId ? tag(s.projectId) : ""}<div class="muted">${s.providers.map(h).join(", ")}</div>${s.query ? `<div class="muted">q: ${h(s.query)}</div>` : ""}</td>
        <td class="mono">${h(s.cron)}<div class="muted">${h(s.timezone)}</div></td>
        <td class="mono">${h(s.nextRunAt)}</td>
        <td>${s.lastRunAt ? `<div class="mono">${h(s.lastRunAt)}</div>${s.lastRunStatus ? tag(s.lastRunStatus) : ""}${s.lastRunId ? `<div class="mono"><a href="/ops/runs/${h(s.lastRunId)}/view">${h(s.lastRunId)}</a></div>` : ""}` : `<span class="muted">never</span>`}</td>
        <td>${tag(s.status)}</td>
        <td><div class="hero-actions inline">
          ${s.status === "active"
            ? `<button type="button" data-schedule-id="${h(s.id)}" data-schedule-action="pause" class="secondary">Pause</button>`
            : `<button type="button" data-schedule-id="${h(s.id)}" data-schedule-action="resume">Resume</button>`}
          <button type="button" data-schedule-id="${h(s.id)}" data-schedule-action="run-now" class="secondary">Run Now</button>
          <button type="button" data-schedule-id="${h(s.id)}" data-schedule-action="delete" class="secondary">Delete</button>
        </div></td>
      </tr>`).join("")}</tbody>
    </table>`}
    <details class="schedule-form" style="margin-top:18px">
      <summary>+ New Schedule</summary>
      <form id="ops-schedule-form" style="margin-top:12px; display:grid; gap:12px;">
        <div class="form-row">
          <label>Topic
            <select name="topicId">
              ${activeTopics.map((topic) => `<option value="${h(topic.id)}" data-sources='${h(JSON.stringify(topic.dataSources))}' data-project="${h(topic.projectId)}" data-query="${h(topic.name)}">${h(topic.name)} / ${h(topic.id)}</option>`).join("")}
            </select>
          </label>
          <label>Action
            <select name="action">
              <option value="collect-and-normalize-topic" selected>collect-and-normalize</option>
              <option value="collect-topic">collect</option>
              <option value="normalize-topic">normalize</option>
            </select>
          </label>
        </div>
        <div class="provider-checks">
          ${collectableProviders.map((provider) => {
            const missing = provider.envState === "missing";
            const disabled = missing ? "disabled" : "";
            const initialChecked = !missing && (activeTopics[0]?.dataSources.includes(provider.id) ?? false);
            return `<label class="check ${missing ? "disabled" : ""}">
              <input type="checkbox" name="schedProviders" value="${h(provider.id)}" ${initialChecked ? "checked" : ""} ${disabled} />
              <span>${h(provider.id)}</span>
              ${missing ? `<small>missing env</small>` : ""}
            </label>`;
          }).join("")}
        </div>
        <div class="form-row">
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
        <div class="form-row">
          <label>Query (optional)
            <input name="schedQuery" placeholder="defaults to topic name" />
          </label>
          <label>Limit
            <input type="number" name="schedLimit" min="1" max="25" value="10" />
            <small class="muted">max 25 per run</small>
          </label>
        </div>
        <label class="check"><input type="checkbox" name="schedDryRun" /> <span>dry-run</span></label>
        <div class="hero-actions inline">
          <button type="button" data-schedule-create>Create Schedule</button>
        </div>
      </form>
    </details>
    <div id="ops-schedule-result" class="empty" style="margin-top:12px">Schedules go through the same Ops Action flow; runs still land in the review queue.</div>
  </div>`;
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
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } .two { grid-template-columns: 1fr; } .hero { display:block; } }
    @media (max-width: 680px) { .cards { grid-template-columns: repeat(2, 1fr); } h1 { font-size:42px; } table { font-size:12px; } }
  `;
}
