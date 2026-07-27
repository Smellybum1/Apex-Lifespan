import {
  buildOperatorReadinessReport,
  summarizeOperatorReadinessCheck,
  summarizeOperatorReadinessReport
} from "@/lib/operator/readiness";
import { loadEnvFile, mergeEnv } from "@/lib/env-file";

function main() {
  const args = readOperatorReadinessArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);
  const context = {
    env
  };

  if (args.checkId) {
    const packet = summarizeOperatorReadinessCheck(context, args.checkId);

    if (!packet.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(packet, null, 2));
    return;
  }

  const report = buildOperatorReadinessReport({
    env
  });

  console.log(
    JSON.stringify(args.summary ? summarizeOperatorReadinessReport(report) : report, null, 2)
  );
}

interface OperatorReadinessCliArgs {
  checkId?: string;
  envFilePath?: string;
  summary: boolean;
}

function readOperatorReadinessArgs(args: string[]): OperatorReadinessCliArgs {
  const parsed: OperatorReadinessCliArgs = {
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--check") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--check requires an operator readiness check id.");
      }

      parsed.checkId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--check=")) {
      const value = arg.slice("--check=".length).trim();

      if (!value) {
        throw new Error("--check requires an operator readiness check id.");
      }

      parsed.checkId = value;
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

    throw new Error(`Unknown operator readiness argument: ${arg}`);
  }

  if (parsed.summary && parsed.checkId) {
    throw new Error("--summary cannot be combined with --check.");
  }

  return parsed;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
// Legacy/reference process script. Not part of ordinary local product work.
// Prefer the dashboard/local ingestion flow unless the user explicitly asks for operator readiness.
