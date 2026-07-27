import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  runProductionMigrationRehearsal,
  type ProductionMigrationRehearsalCommandResult
} from "@/lib/production-migration-rehearsal";
import { loadEnvFile, mergeEnv } from "@/lib/env-file";

function main() {
  const args = readProductionMigrationRehearsalArgs(process.argv.slice(2));
  const envFile = args.envFilePath ? loadEnvFile(args.envFilePath) : undefined;
  const commandEnv = mergeEnv(process.env, envFile?.env);
  const result = runProductionMigrationRehearsal({
    context: {
      apply: args.apply,
      env: commandEnv,
      migrationDirectories: readMigrationDirectories()
    },
    runner: (command, commandArgs) => runCommand(command, commandArgs, commandEnv)
  });

  console.log(JSON.stringify(result, null, 2));

  if ((args.apply && !result.executed) || result.commandResults.some((command) => !command.ok)) {
    process.exitCode = 1;
  }
}

function runCommand(
  command: string,
  args: readonly string[],
  env: Record<string, string | undefined>
): ProductionMigrationRehearsalCommandResult {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
    stdio: "pipe"
  });
  const commandLabel = [command, ...args].join(" ");

  return {
    command: commandLabel,
    exitCode: result.status ?? 1,
    ok: result.status === 0
  };
}

interface ProductionMigrationRehearsalCliArgs {
  apply: boolean;
  envFilePath?: string;
}

function readProductionMigrationRehearsalArgs(
  args: string[]
): ProductionMigrationRehearsalCliArgs {
  const parsed: ProductionMigrationRehearsalCliArgs = {
    apply: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      parsed.apply = true;
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

    throw new Error(`Unknown production migration rehearsal argument: ${arg}`);
  }

  return parsed;
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
