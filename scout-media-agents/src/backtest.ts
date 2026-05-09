import path from "node:path";
import { buildExpansionRegistry } from "./keywordExpansion.js";
import { collectLlmSupplements } from "./llmExpansion.js";
import { defaultSeedFile, loadSeedRegistry } from "./seedRegistry.js";
import { resolveRuntimePolicy } from "./runtimePolicy.js";
import { buildQueryScheduleStates } from "./queryScheduleState.js";
import { countTasksByPlatform, planDueTasks } from "./taskPlanner.js";
import { BacktestReport, RuntimeProfileName } from "./types.js";
import { applyTaskSuccess, exportTrendSignals, synthesizeTrendSignals } from "./trendSignals.js";
import { ensureDir, writeJson } from "./utils.js";

export type BacktestOptions = {
  projectRoot: string;
  seedFile?: string;
  stateDir?: string;
  runtimeProfile?: RuntimeProfileName;
};

export async function runBacktest(options: BacktestOptions): Promise<BacktestReport> {
  const startedAt = new Date();
  const runtimeProfile = options.runtimeProfile || "safe_live";
  const runId = `sma_bt_${startedAt.toISOString().replaceAll(/[:.]/g, "-")}`;
  const seedFile = options.seedFile ? path.resolve(options.seedFile) : defaultSeedFile(options.projectRoot);
  const stateDir = options.stateDir
    ? path.resolve(options.stateDir)
    : path.join(options.projectRoot, "state", "backtests", runId);

  await ensureDir(stateDir);
  await ensureDir(path.join(stateDir, "runtime"));
  await ensureDir(path.join(stateDir, "reports"));

  const seeds = await loadSeedRegistry(seedFile);
  const llmExpansion = await collectLlmSupplements(options.projectRoot, seeds);
  const expansions = buildExpansionRegistry(seeds, startedAt, llmExpansion.supplements);
  const queryStates = buildQueryScheduleStates(seeds, expansions, startedAt);

  const round1 = planDueTasks(seeds, queryStates, startedAt, runtimeProfile);
  const round1Signals = synthesizeTrendSignals(round1.tasks, startedAt);
  const round1CompletedStates = applyTaskSuccess(round1.states, round1.tasks, startedAt);

  const immediateReplayAt = new Date(startedAt.getTime() + 60_000);
  const immediateReplay = planDueTasks(seeds, round1CompletedStates, immediateReplayAt, runtimeProfile);

  const round2At = new Date(startedAt.getTime() + 8 * 86_400_000);
  const round2 = planDueTasks(seeds, round1CompletedStates, round2At, runtimeProfile);
  const round2Signals = synthesizeTrendSignals(round2.tasks, round2At);
  const round2CompletedStates = applyTaskSuccess(round2.states, round2.tasks, round2At);

  const policies = [...new Set(queryStates.map((state) => state.platform))].map((platform) => resolveRuntimePolicy(platform, runtimeProfile));
  const allSignals = [...round1Signals, ...round2Signals];
  const exportPaths = await exportTrendSignals(stateDir, runId, allSignals);

  await writeJson(path.join(stateDir, "runtime", "seeds.json"), seeds);
  await writeJson(path.join(stateDir, "runtime", "llm-expansion.json"), llmExpansion);
  await writeJson(path.join(stateDir, "runtime", "expansion-registry.json"), expansions);
  await writeJson(path.join(stateDir, "runtime", "query-schedule-states.round0.json"), queryStates);
  await writeJson(path.join(stateDir, "runtime", "query-schedule-states.round1.json"), round1CompletedStates);
  await writeJson(path.join(stateDir, "runtime", "query-schedule-states.round2.json"), round2CompletedStates);
  await writeJson(path.join(stateDir, "runtime", "planned-tasks.round1.json"), round1.tasks);
  await writeJson(path.join(stateDir, "runtime", "planned-tasks.round2.json"), round2.tasks);
  await writeJson(path.join(stateDir, "runtime", "runtime-policies.json"), policies);
  await writeJson(path.join(stateDir, "runtime", "synthetic-signals.json"), allSignals);

  const completedAt = new Date();
  const report: BacktestReport = {
    runId,
    seedFile,
    stateDir,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    runtimeProfile,
    seedCount: seeds.length,
    expansionCount: expansions.length,
    approvedExpansionCount: expansions.filter((item) => item.status === "approved").length,
    queryStateCount: queryStates.length,
    plannedTaskCountRound1: round1.tasks.length,
    plannedTaskCountImmediateReplay: immediateReplay.tasks.length,
    plannedTaskCountRound2: round2.tasks.length,
    signalCount: allSignals.length,
    exportedSignalCount: allSignals.length ? JSON.parse(await (await import("node:fs/promises")).readFile(exportPaths.currentJson, "utf-8")).count as number : 0,
    duePlatformsRound1: countTasksByPlatform(round1.tasks),
    duePlatformsRound2: countTasksByPlatform(round2.tasks),
    paths: {
      reportJson: path.join(stateDir, "reports", "backtest-report.json"),
      reportSummary: path.join(stateDir, "reports", "backtest-summary.txt"),
      currentTrendSignalJson: exportPaths.currentJson,
      currentTrendSignalCsv: exportPaths.currentCsv,
      currentManifest: exportPaths.manifest,
    },
  };

  const summaryLines = [
    `run_id=${report.runId}`,
    `seed_count=${report.seedCount}`,
    `expansion_count=${report.expansionCount}`,
    `approved_expansion_count=${report.approvedExpansionCount}`,
    `query_state_count=${report.queryStateCount}`,
    `planned_round1=${report.plannedTaskCountRound1}`,
    `planned_immediate_replay=${report.plannedTaskCountImmediateReplay}`,
    `planned_round2=${report.plannedTaskCountRound2}`,
    `signal_count=${report.signalCount}`,
    `exported_signal_count=${report.exportedSignalCount}`,
    `state_dir=${report.stateDir}`,
  ];

  await writeJson(report.paths.reportJson, report);
  await (await import("node:fs/promises")).writeFile(report.paths.reportSummary, `${summaryLines.join("\n")}\n`, "utf-8");
  return report;
}
