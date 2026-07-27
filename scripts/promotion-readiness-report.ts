import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const args = readPromotionReadinessArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const {
      buildSourceCandidatePromotionReadinessReport,
      summarizeSourceCandidatePromotionReadinessReport
    } = await import("@/lib/operator/curation-promotion");
    const report = await buildSourceCandidatePromotionReadinessReport({
      limit: args.limit
    });

    console.log(
      JSON.stringify(
        args.summary ? summarizeSourceCandidatePromotionReadinessReport(report) : report,
        null,
        2
      )
    );
  });
}

interface PromotionReadinessCliArgs {
  envFilePath?: string;
  limit: number;
  summary: boolean;
}

function readPromotionReadinessArgs(args: string[]): PromotionReadinessCliArgs {
  const parsed: PromotionReadinessCliArgs = {
    limit: 5,
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = parseLimit(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      parsed.limit = parseLimit(arg.slice("--limit=".length));
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

    throw new Error(`Unknown promotion readiness argument: ${arg}`);
  }

  return parsed;
}

function parseLimit(value: string | undefined) {
  const limit = Number(value?.trim());

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("--limit requires an integer between 1 and 50.");
  }

  return limit;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
// Legacy/reference process script. Not part of ordinary local product work.
// Prefer the dashboard/local ingestion flow unless the user explicitly asks for promotion readiness.
