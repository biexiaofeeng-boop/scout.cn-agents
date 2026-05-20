import { randomUUID } from "node:crypto";
import { loadSettings, Settings } from "./config.js";
import { MediaCrawlerAdapter } from "./adapters/mediaCrawlerAdapter.js";
import { WechatSpiderAdapter } from "./adapters/wechatSpiderAdapter.js";
import { FileStateStore } from "./state/store.js";
import { PipelineRun } from "./models.js";
import { retryCall } from "./retry.js";

export class ScoutPipeline {
  readonly settings: Settings;
  readonly store: FileStateStore;
  readonly mediaAdapter: MediaCrawlerAdapter;
  readonly wechatAdapter: WechatSpiderAdapter;

  constructor(settings: Settings = loadSettings()) {
    this.settings = settings;
    this.store = new FileStateStore(settings.stateDir);
    this.mediaAdapter = new MediaCrawlerAdapter(settings.mediaCrawlerRoot, settings.batchSize);
    this.wechatAdapter = new WechatSpiderAdapter(settings, settings.batchSize);
  }

  private async ingestMediaCrawler(): Promise<{ inserted: number; skipped: number; failed: number }> {
    const cursorKey = "cursor:mediacrawler";
    const oldCursor = await this.store.getCheckpoint<Record<string, number>>(cursorKey, {});
    try {
      const { events, cursor } = await retryCall(() => this.mediaAdapter.loadIncremental(oldCursor), 3, 500);
      const stats = await this.store.insertEvents(events);
      await this.store.setCheckpoint(cursorKey, cursor);
      return { inserted: stats.inserted, skipped: stats.skipped, failed: 0 };
    } catch (err) {
      await this.store.pushDlq("mediacrawler", { cursor: oldCursor }, `source_load_failed: ${String(err)}`);
      return { inserted: 0, skipped: 0, failed: 1 };
    }
  }

  private async ingestWechat(): Promise<{ inserted: number; skipped: number; failed: number }> {
    const cursorKey = "cursor:wechat-spider";
    const oldCursor = await this.store.getCheckpoint<{ wechatArticleLastId?: number; wechatCommentLastId?: number }>(
      cursorKey,
      {},
    );
    try {
      const { events, cursor } = await retryCall(() => this.wechatAdapter.loadIncremental(oldCursor), 3, 500);
      const stats = await this.store.insertEvents(events);
      await this.store.setCheckpoint(cursorKey, cursor);
      return { inserted: stats.inserted, skipped: stats.skipped, failed: 0 };
    } catch (err) {
      await this.store.pushDlq("wechat-spider", { cursor: oldCursor }, `source_load_failed: ${String(err)}`);
      return { inserted: 0, skipped: 0, failed: 1 };
    }
  }

  async runOnce(): Promise<PipelineRun> {
    await this.store.init();

    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let status: PipelineRun["status"] = "success";
    let errorText: string | undefined;

    try {
      const media = await this.ingestMediaCrawler();
      processedCount += media.inserted;
      skippedCount += media.skipped;
      failedCount += media.failed;

      if (this.settings.wechatEnableDb) {
        const wechat = await this.ingestWechat();
        processedCount += wechat.inserted;
        skippedCount += wechat.skipped;
        failedCount += wechat.failed;
      }

      if (failedCount > 0) {
        status = "partial_failed";
      }
    } catch (err) {
      status = "failed";
      failedCount += 1;
      errorText = String(err);
      await this.store.pushDlq("pipeline", { runId }, errorText);
    }

    const endedAt = new Date().toISOString();
    const run: PipelineRun = {
      runId,
      startedAt,
      endedAt,
      status,
      processedCount,
      failedCount,
      errorText,
    };

    await this.store.appendRun(run);
    await this.store.updateCounters((prev) => ({
      ...prev,
      runsTotal: prev.runsTotal + 1,
      runsFailed: prev.runsFailed + (status === "success" ? 0 : 1),
      eventsInserted: prev.eventsInserted + processedCount,
      eventsSkipped: prev.eventsSkipped + skippedCount,
      recordsFailed: prev.recordsFailed + failedCount,
      lastRunAt: endedAt,
    }));

    return run;
  }

  async currentHealth() {
    await this.store.init();
    const h = await this.store.health();
    return {
      ...h,
      alert: h.dlqSize >= this.settings.alertDlqThreshold,
    };
  }
}
