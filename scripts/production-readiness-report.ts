import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { buildProductionReadinessReport } from "@/lib/production-readiness";

const PRIVATE_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

function main() {
  const report = buildProductionReadinessReport({
    env: process.env,
    migrationDirectories: readMigrationDirectories(),
    productionProvisioningChecklistExists: existsSync(
      path.join(process.cwd(), "docs", "codex", "production-provisioning-checklist.md")
    ),
    trackedEnvFiles: readTrackedEnvFiles(),
    vercelCliAvailable: commandAvailable("vercel"),
    vercelProjectLinked: existsSync(path.join(process.cwd(), ".vercel", "project.json"))
  });

  console.log(JSON.stringify(report, null, 2));
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

main();
