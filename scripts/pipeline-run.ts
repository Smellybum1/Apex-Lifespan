/**
 * Headless local UPDATE pipeline.
 *
 * Runs the same stages as the dashboard's UPDATE button with no browser. It
 * calls the data layer in-process rather than the `/api/local-ingestion/*`
 * routes, which is required rather than merely faster: `guardLocalIngestionRequest`
 * demands localhost origin headers, so the HTTP path structurally needs a browser.
 *
 * Dry run is NOT available — every stage of this pipeline writes. That is what
 * it is for. Use `--max-jobs 1` for a small, resumable probe instead.
 *
 *   npx tsx scripts/pipeline-run.ts
 *   npx tsx scripts/pipeline-run.ts --max-jobs 10 --lead-threshold 75
 *
 * Each stage is idempotent and resumable: queued jobs stay in the database, so
 * an interrupted run is continued simply by running again.
 */
import type { LocalIngestionLogEntry } from "@/components/local-ingestion/types";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import { directLocalUpdatePipelineOperations } from "@/lib/pipeline/direct-operations";
import { runLocalUpdatePipeline } from "@/lib/pipeline/run-local-update-pipeline";
import {
  LOCAL_UPDATE_PIPELINE_STAGE_DEFINITIONS,
  type LocalUpdatePipelineSettings,
  type LocalUpdatePipelineStageId,
  type LocalUpdatePipelineStageStatus
} from "@/lib/pipeline/types";

/** Mirrors the dashboard's initial slider values so both entry points agree. */
const DEFAULT_SETTINGS: LocalUpdatePipelineSettings = {
  leadThreshold: 70,
  rejectThreshold: 40,
  runDelayMs: 5000,
  sessionJobLimit: 100
};

interface ParsedArgs {
  settings: LocalUpdatePipelineSettings;
  quiet: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const settings = { ...DEFAULT_SETTINGS };
  let quiet = false;

  const readNumber = (raw: string | undefined, flag: string) => {
    const value = Number(raw);

    if (!Number.isFinite(value)) {
      throw new Error(`${flag} requires a number.`);
    }

    return Math.floor(value);
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--quiet":
        quiet = true;
        break;
      case "--max-jobs":
        index += 1;
        settings.sessionJobLimit = readNumber(argv[index], "--max-jobs");
        break;
      case "--run-delay-ms":
        index += 1;
        settings.runDelayMs = readNumber(argv[index], "--run-delay-ms");
        break;
      case "--lead-threshold":
        index += 1;
        settings.leadThreshold = readNumber(argv[index], "--lead-threshold");
        break;
      case "--reject-threshold":
        index += 1;
        settings.rejectThreshold = readNumber(argv[index], "--reject-threshold");
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (settings.rejectThreshold >= settings.leadThreshold) {
    throw new Error(
      `--reject-threshold (${settings.rejectThreshold}) must be below --lead-threshold (${settings.leadThreshold}); the park band between them would otherwise be empty.`
    );
  }

  return { quiet, settings };
}

function usage() {
  return [
    "Usage: npx tsx scripts/pipeline-run.ts [options]",
    "",
    "  --max-jobs <n>          Ingestion jobs to process this run (default 100).",
    "  --run-delay-ms <n>      Pause between ingestion pulses (default 5000).",
    "  --lead-threshold <n>    Build leads at or above this score (default 70).",
    "  --reject-threshold <n>  Reject below this score (default 40).",
    "  --quiet                 Only print stage transitions and the summary.",
    "",
    "Every stage writes. There is no dry-run mode; use --max-jobs 1 to probe."
  ].join("\n");
}

function timestamp() {
  return new Date().toISOString();
}

async function main() {
  const { quiet, settings } = parseArgs(process.argv.slice(2));
  const stageLabels = new Map<LocalUpdatePipelineStageId, string>(
    LOCAL_UPDATE_PIPELINE_STAGE_DEFINITIONS.map((stage) => [stage.id, stage.label])
  );
  const stageErrors: string[] = [];
  let stopping = false;

  // A second Ctrl-C exits immediately; the first lets the current stage finish
  // so the run stops at a resumable boundary rather than mid-write.
  process.on("SIGINT", () => {
    if (stopping) {
      console.error("Second interrupt received; exiting now.");
      process.exit(130);
    }

    stopping = true;
    console.error("\nInterrupt received; stopping at the next stage boundary.");
  });

  const appendLog = (entry: Omit<LocalIngestionLogEntry, "id" | "timestamp">) => {
    if (quiet && entry.level !== "error") {
      return;
    }

    const stream = entry.level === "error" ? console.error : console.log;
    stream(`${timestamp()} [${entry.level}] ${entry.message}${entry.detail ? ` — ${entry.detail}` : ""}`);
  };

  const setStageStatus = (
    id: LocalUpdatePipelineStageId,
    status: LocalUpdatePipelineStageStatus,
    detail?: string
  ) => {
    // "running" fires repeatedly inside batch loops as progress detail changes;
    // printing every one would bury the log. Terminal transitions only.
    if (status === "running") {
      return;
    }

    const label = stageLabels.get(id) ?? id;

    if (status === "error") {
      stageErrors.push(`${label}: ${detail ?? "stage reported an error"}`);
      console.error(`${timestamp()} [stage:${status}] ${label}${detail ? ` — ${detail}` : ""}`);
      return;
    }

    console.log(`${timestamp()} [stage:${status}] ${label}${detail ? ` — ${detail}` : ""}`);
  };

  console.log(
    `${timestamp()} Starting headless UPDATE — leads ${settings.leadThreshold}+, park ${settings.rejectThreshold}-${
      settings.leadThreshold - 1
    }, ${settings.sessionJobLimit} job cap, ${settings.runDelayMs}ms pulse.`
  );

  // Same env handling as the other local scripts: `.env.local` supplies
  // DATABASE_URL and APEX_DATA_SOURCE when the shell has not.
  const env = mergeEnv(process.env, loadEnvFile(".env.local").env);
  const result = await withProcessEnv(env, () =>
    runLocalUpdatePipeline({
      appendLog,
      operations: directLocalUpdatePipelineOperations(),
      setStageStatus,
      settings,
      shouldStop: () => stopping
    })
  );

  if (result.status === "stopped") {
    console.error(`${timestamp()} UPDATE stopped before finishing. Re-run to resume.`);
    process.exitCode = 130;
    return;
  }

  if (stageErrors.length > 0) {
    // Completed, but stages reported row-level failures. Exit non-zero so a
    // cron surfaces it instead of reporting a clean run.
    console.error(`${timestamp()} UPDATE completed with ${stageErrors.length} stage error(s):`);

    for (const stageError of stageErrors) {
      console.error(`  - ${stageError}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`${timestamp()} UPDATE completed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
