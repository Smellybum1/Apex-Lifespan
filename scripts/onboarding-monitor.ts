import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

process.env.APEX_PRISMA_LOG ??= "silent";

interface OnboardingMonitorArgs {
  envFilePath?: string;
  fullTextInventoryFilePath?: string;
  supplement?: string;
  summary: boolean;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const env = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(env, async () => {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { parseFullTextSourceInventory } = await import(
      "@/lib/full-text-source-readiness"
    );
    const {
      buildSupplementOnboardingQualityDashboard
    } = await import("@/lib/supplement-onboarding-quality");
    const {
      filterSupplementOnboardingMonitorDashboard,
      summarizeSupplementOnboardingMonitorDashboard
    } = await import("@/lib/supplement-onboarding-monitor");
    const { readSupplementOnboardingSourceSignals } = await import(
      "@/lib/supplement-onboarding-source-signals"
    );

    const data = await getEvidenceDashboardData();
    const sourceSignals = await readSupplementOnboardingSourceSignals({ data });
    const fullTextSourceInventory = args.fullTextInventoryFilePath
      ? parseFullTextSourceInventory(
          JSON.parse(await readFile(args.fullTextInventoryFilePath, "utf8")) as unknown
        )
      : undefined;
    const dashboard = buildSupplementOnboardingQualityDashboard({
      data,
      fullTextInventoryPath: args.fullTextInventoryFilePath,
      fullTextSourceInventory,
      sourceSignals
    });
    const monitor = filterSupplementOnboardingMonitorDashboard(
      dashboard.monitor,
      args.supplement
    );

    console.log(
      JSON.stringify(
        args.summary ? summarizeSupplementOnboardingMonitorDashboard(monitor) : monitor,
        null,
        2
      )
    );
  });
}

function readArgs(args: string[]): OnboardingMonitorArgs {
  const parsed: OnboardingMonitorArgs = {
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }

    if (arg === "--supplement") {
      parsed.supplement = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--supplement=")) {
      parsed.supplement = readInlineValue(arg, "--supplement");
      continue;
    }

    if (arg === "--env-file") {
      parsed.envFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFilePath = readInlineValue(arg, "--env-file");
      continue;
    }

    if (arg === "--fulltext-inventory-file") {
      parsed.fullTextInventoryFilePath = readRequiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--fulltext-inventory-file=")) {
      parsed.fullTextInventoryFilePath = readInlineValue(arg, "--fulltext-inventory-file");
      continue;
    }

    throw new Error(`Unknown onboarding monitor option: ${arg}`);
  }

  return parsed;
}

function readRequiredValue(args: string[], index: number, option: string) {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function readInlineValue(arg: string, option: string) {
  const value = arg.slice(`${option}=`.length).trim();

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
