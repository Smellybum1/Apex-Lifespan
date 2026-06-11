import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { planScheduledSourceIngestionDryRun } from "@/lib/data/scheduled-ingestion";
import { summarizeEvidenceCoverage } from "@/lib/evidence-coverage";
import {
  buildLaunchReadinessReport,
  FULLY_LIVE_LAUNCH_CHECKLIST_PATH,
  POST_LAUNCH_REVIEW_TEMPLATE_PATH
} from "@/lib/launch-readiness";
import { buildOperationsReadinessReport } from "@/lib/operations-readiness";
import { getSourceCandidatePromotionReadinessSnapshot } from "@/lib/operator/curation-promotion";
import { buildOperatorReadinessReport } from "@/lib/operator/readiness";
import { buildProductionReadinessReport } from "@/lib/production-readiness";

const PRIVATE_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

async function main() {
  const [scheduledIngestion, promotion, evidenceCoverage] = await Promise.all([
    readScheduledIngestionEvidence(),
    readPromotionEvidence(),
    readEvidenceCoverage()
  ]);

  const report = buildLaunchReadinessReport({
    env: process.env,
    evidenceCoverage,
    files: readLaunchReadinessFiles(),
    operations: buildOperationsReadinessReport({ env: process.env }),
    operator: buildOperatorReadinessReport({ env: process.env }),
    production: buildProductionReadinessReport({
      env: process.env,
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

  console.log(JSON.stringify(report, null, 2));
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
    const plan = await planScheduledSourceIngestionDryRun();

    return {
      hostedCronReady: plan.policy.hostedCronReady,
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
