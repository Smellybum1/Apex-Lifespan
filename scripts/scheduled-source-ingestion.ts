import { loadEnvFile, mergeEnv } from "@/lib/env-file";

async function main() {
  const { apply, envFilePath, maxJobsPerRun, requireHostedRunReadiness, summary } =
    readScheduledIngestionArgs(
      process.argv.slice(2)
    );
  const envFile = envFilePath ? loadEnvFile(envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const {
      planScheduledSourceIngestionDryRun,
      runScheduledSourceIngestionBatch,
      summarizeScheduledSourceIngestionDryRun
    } = await import("@/lib/data/scheduled-ingestion");

    if (apply) {
      if (summary) {
        throw new Error("--summary is read-only and cannot be combined with --apply.");
      }

      const result = await runScheduledSourceIngestionBatch({
        apply,
        env,
        maxJobsPerRun,
        requireHostedRunReadiness
      });

      console.log(JSON.stringify(result, null, 2));

      if (result.blocked) {
        process.exitCode = 1;
      }

      return;
    }

    const plan = await planScheduledSourceIngestionDryRun({ env, maxJobsPerRun });
    const output = summary ? summarizeScheduledSourceIngestionDryRun(plan) : plan;

    console.log(JSON.stringify(output, null, 2));
  });
}

interface ScheduledIngestionCliArgs {
  apply: boolean;
  envFilePath?: string;
  maxJobsPerRun?: number;
  requireHostedRunReadiness: boolean;
  summary: boolean;
}

function readScheduledIngestionArgs(args: string[]): ScheduledIngestionCliArgs {
  const parsed: ScheduledIngestionCliArgs = {
    apply: false,
    requireHostedRunReadiness: false,
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--require-hosted-run-readiness") {
      parsed.requireHostedRunReadiness = true;
      continue;
    }

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      parsed.envFilePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      const value = arg.slice("--env-file=".length).trim();

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      parsed.envFilePath = value;
      continue;
    }

    if (arg === "--max-jobs") {
      parsed.maxJobsPerRun = parseMaxJobs(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--max-jobs=")) {
      parsed.maxJobsPerRun = parseMaxJobs(arg.slice("--max-jobs=".length));
      continue;
    }

    throw new Error(`Unknown scheduled ingestion argument: ${arg}`);
  }

  if (parsed.requireHostedRunReadiness && !parsed.apply) {
    throw new Error("--require-hosted-run-readiness can only be combined with --apply.");
  }

  return parsed;
}

function parseMaxJobs(value: string | undefined) {
  const maxJobs = Number(value?.trim());

  if (!Number.isInteger(maxJobs) || maxJobs < 1) {
    throw new Error("--max-jobs requires a positive integer.");
  }

  return maxJobs;
}

async function withProcessEnv<T>(
  env: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousEnv = { ...process.env };

  try {
    for (const key of Object.keys(process.env)) {
      if (!(key in env)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    return await callback();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(previousEnv)) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
// Legacy/reference process script. Not part of ordinary local product work.
// Prefer the local dashboard ingestion runner unless the user explicitly asks for hosted scheduling.
