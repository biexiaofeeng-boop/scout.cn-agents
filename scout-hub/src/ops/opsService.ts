import path from "node:path";
import { ScoutPipeline } from "../pipeline.js";
import { loadOpsTopics, providersWithEnvState } from "./opsRegistry.js";
import { OpsReviewService } from "./opsReviewService.js";
import { listRecentOpsRuns, scanTopicArtifacts } from "./runtimeScanner.js";
import type { OpsOverview } from "./types.js";
import { projectRuntimeRoot } from "./projectRuntime.js";

export class OpsService {
  private readonly reviewService: OpsReviewService;

  constructor(private readonly pipeline: ScoutPipeline) {
    this.reviewService = new OpsReviewService(pipeline.settings.runtimeRoot);
  }

  async buildOverview(): Promise<OpsOverview> {
    const topicConfigPath = path.join(this.pipeline.settings.projectRoot, "scout-media-agents", "config", "topics", "scout-topics.json");
    const runtimeRoot = this.pipeline.settings.runtimeRoot;
    const topics = await loadOpsTopics(topicConfigPath);
    const projectIds = [...new Set(topics.map((topic) => topic.projectId).filter(Boolean))];
    const topicArtifacts = await Promise.all(topics.map((topic) => scanTopicArtifacts(runtimeRoot, topic.vertical, topic.id, topic.projectId)));
    const topicRows = topics.map((topic, index) => ({ ...topic, artifacts: topicArtifacts[index] }));
    const hubHealth = await this.pipeline.currentHealth();
    const recentRuns = await this.pipeline.store.recentRuns(12);
    const alerts = this.buildAlerts(hubHealth);
    const providers = providersWithEnvState();
    const recentOpsRuns = await listRecentOpsRuns(runtimeRoot, 12, projectIds);
    const reviewQueue = (await Promise.all([
      this.reviewService.list(20),
      ...projectIds.map((projectId) => new OpsReviewService(projectRuntimeRoot(runtimeRoot, projectId)).list(20)),
    ])).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: this.pipeline.settings.projectRoot,
      runtimeRoot,
      topicConfigPath,
      hubHealth,
      alerts,
      providers,
      topics: topicRows,
      recentRuns,
      recentOpsRuns,
      reviewQueue,
      summary: {
        topicCount: topicRows.length,
        activeTopicCount: topicRows.filter((topic) => topic.status === "active").length,
        providerCount: providers.length,
        readyProviderCount: providers.filter((provider) => provider.status !== "planned" && provider.envState !== "missing").length,
        topicsWithHandoff: topicRows.filter((topic) => topic.artifacts.gameLensHandoffExists).length,
        topicsWithReport: topicRows.filter((topic) => topic.artifacts.reportExists).length,
        rawRecordCount: topicRows.reduce((sum, topic) => sum + topic.artifacts.rawRecordCount, 0),
        normalizedEvidenceCount: topicRows.reduce((sum, topic) => sum + topic.artifacts.normalizedRecordCount, 0),
        pendingReviewCount: reviewQueue.filter((item) => item.status === "pending").length,
      },
    };
  }

  private buildAlerts(health: Awaited<ReturnType<ScoutPipeline["currentHealth"]>>): Array<{ level: string; code: string; message: string }> {
    const alerts: Array<{ level: string; code: string; message: string }> = [];
    if (health.dlqSize >= this.pipeline.settings.alertDlqThreshold) {
      alerts.push({
        level: "warning",
        code: "DLQ_THRESHOLD",
        message: `DLQ size=${health.dlqSize}, threshold=${this.pipeline.settings.alertDlqThreshold}`,
      });
    }
    if (health.metrics.runsFailed > 0) {
      alerts.push({
        level: "warning",
        code: "PIPELINE_FAILURE",
        message: `pipeline failures observed=${health.metrics.runsFailed}`,
      });
    }
    return alerts;
  }
}
