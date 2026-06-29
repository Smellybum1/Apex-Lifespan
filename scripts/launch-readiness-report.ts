import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  buildLaunchReadinessReport,
  FULLY_LIVE_LAUNCH_CHECKLIST_PATH,
  POST_LAUNCH_REVIEW_TEMPLATE_PATH,
  summarizeLaunchReadinessReport
} from "@/lib/launch-readiness";
import { buildOperationsReadinessReport } from "@/lib/operations-readiness";
import { buildOperatorReadinessReport } from "@/lib/operator/readiness";
import { buildProductionReadinessReport } from "@/lib/production-readiness";
import { loadEnvFile, mergeEnv } from "@/lib/env-file";

const PRIVATE_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

async function main() {
  const args = readLaunchReadinessArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const initialEnv = mergeEnv(process.env, envFile?.env);

  await withProcessEnv(initialEnv, async () => {
    const [scheduledIngestion, promotion, evidenceCoverage] = await Promise.all([
      readScheduledIngestionEvidence(),
      readPromotionEvidence(),
      readEvidenceCoverage()
    ]);

    const report = buildLaunchReadinessReport({
      env: initialEnv,
      evidenceCoverage,
      files: readLaunchReadinessFiles(),
      operations: buildOperationsReadinessReport({ env: initialEnv }),
      operator: buildOperatorReadinessReport({ env: initialEnv }),
      production: buildProductionReadinessReport({
        env: initialEnv,
        migrationDirectories: readMigrationDirectories(),
        productionProvisioningChecklistExists: existsSync(
          path.join(process.cwd(), "docs", "codex", "production-provisioning-checklist.md")
        ),
        trackedEnvFiles: readTrackedEnvFiles(),
        vercelCliAvailable: commandAvailable("vercel"),
        vercelProjectLinked: existsSync(path.join(process.cwd(), ".vercel", "project.json"))
      }),
      promotion,
      scheduledIngestion
    });

    console.log(
      JSON.stringify(
        args.summary ? summarizeLaunchReadinessReport(report) : report,
        null,
        2
      )
    );
  });
}

interface LaunchReadinessCliArgs {
  envFilePath?: string;
  summary: boolean;
}

function readLaunchReadinessArgs(args: string[]): LaunchReadinessCliArgs {
  const parsed: LaunchReadinessCliArgs = {
    summary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

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

    throw new Error(`Unknown launch readiness argument: ${arg}`);
  }

  return parsed;
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

function readLaunchReadinessFiles() {
  return {
    launchChecklist: existsSync(path.join(process.cwd(), FULLY_LIVE_LAUNCH_CHECKLIST_PATH)),
    postLaunchReviewTemplate: existsSync(
      path.join(process.cwd(), POST_LAUNCH_REVIEW_TEMPLATE_PATH)
    )
  };
}

async function readScheduledIngestionEvidence() {
  try {
    const { planScheduledSourceIngestionDryRun } = await import(
      "@/lib/data/scheduled-ingestion"
    );
    const plan = await planScheduledSourceIngestionDryRun();

    return {
      hostedCronReady: plan.policy.hostedCronReady,
      hostedRunGateReady: plan.hostedRunGate.ready,
      missingEnv: [
        ...plan.policy.hostedCron.missingEnv,
        ...plan.failureReview.retryPolicy.missingEnv
      ],
      noAutoPromotion: plan.noAutoPromotion,
      retryAutomationReady: plan.failureReview.retryAutomationReady
    };
  } catch {
    return {
      unavailable: true
    };
  }
}

async function readPromotionEvidence() {
  try {
    const { getSourceCandidatePromotionReadinessSnapshot } = await import(
      "@/lib/operator/curation-promotion"
    );

    return {
      snapshot: await getSourceCandidatePromotionReadinessSnapshot(10)
    };
  } catch {
    return {
      unavailable: true
    };
  }
}

async function readEvidenceCoverage() {
  try {
    const { getEvidenceDashboardData } = await import("@/lib/data/dashboard");
    const { summarizeEvidenceCoverage } = await import("@/lib/evidence-coverage");
    const data = await getEvidenceDashboardData();

    return {
      dataSource: data.dataSource,
      report: summarizeEvidenceCoverage(data)
    };
  } catch {
    return {
      dataSource: "unavailable",
      unavailable: true
    };
  }
}

function readMigrationDirectories() {
  const migrationsPath = path.join(process.cwd(), "prisma", "migrations");

  if (!existsSync(migrationsPath)) {
    return [];
  }

  return readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readTrackedEnvFiles() {
  const result = spawnSync("git", ["ls-files", ...PRIVATE_ENV_FILES], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function commandAvailable(command: string) {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [command], {
    encoding: "utf8",
    stdio: "ignore"
  });

  return result.status === 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
// Legacy/reference process script. Not part of ordinary local product work.
// Prefer the simplified local workflow unless the user explicitly asks for launch readiness.
