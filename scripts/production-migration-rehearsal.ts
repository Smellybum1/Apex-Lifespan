import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  runProductionMigrationRehearsal,
  type ProductionMigrationRehearsalCommandResult
} from "@/lib/production-migration-rehearsal";

function main() {
  const apply = process.argv.includes("--apply");
  const result = runProductionMigrationRehearsal({
    context: {
      apply,
      env: process.env,
      migrationDirectories: readMigrationDirectories()
    },
    runner: runCommand
  });

  console.log(JSON.stringify(result, null, 2));

  if ((apply && !result.executed) || result.commandResults.some((command) => !command.ok)) {
    process.exitCode = 1;
  }
}

function runCommand(
  command: string,
  args: readonly string[]
): ProductionMigrationRehearsalCommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe"
  });
  const commandLabel = [command, ...args].join(" ");

  return {
    command: commandLabel,
    exitCode: result.status ?? 1,
    ok: result.status === 0
  };
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

main();
