import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  buildProductionReadinessReport,
  summarizeProductionReadinessCheck,
  type ProductionReadinessContext
} from "@/lib/production-readiness";

const PRIVATE_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

function main() {
  const checkId = readCheckId(process.argv.slice(2));
  const context = readProductionReadinessContext();

  if (checkId) {
    const packet = summarizeProductionReadinessCheck(context, checkId);

    if (!packet.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(packet, null, 2));
    return;
  }

  const report = buildProductionReadinessReport(context);

  console.log(JSON.stringify(report, null, 2));
}

function readProductionReadinessContext(): ProductionReadinessContext {
  return {
    env: process.env,
    migrationDirectories: readMigrationDirectories(),
    productionProvisioningChecklistExists: existsSync(
      path.join(process.cwd(), "docs", "codex", "production-provisioning-checklist.md")
    ),
    trackedEnvFiles: readTrackedEnvFiles(),
    vercelCliAvailable: commandAvailable("vercel"),
    vercelProjectLinked: existsSync(path.join(process.cwd(), ".vercel", "project.json"))
  };
}

function readCheckId(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--check") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--check requires a production readiness check id.");
      }

      return value;
    }

    if (arg.startsWith("--check=")) {
      const value = arg.slice("--check=".length).trim();

      if (!value) {
        throw new Error("--check requires a production readiness check id.");
      }

      return value;
    }

    throw new Error(`Unknown production readiness argument: ${arg}`);
  }

  return undefined;
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
