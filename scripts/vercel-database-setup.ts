import { spawnSync } from "node:child_process";

import {
  runVercelDatabaseSetup,
  type VercelDatabaseSetupCommandResult
} from "@/lib/vercel-database-setup";

const result = runVercelDatabaseSetup({
  context: {
    env: process.env
  },
  runner: runCommand
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "blocked" || result.commandResults.some((command) => !command.ok)) {
  process.exitCode = 1;
}

function runCommand(
  command: string,
  args: readonly string[]
): VercelDatabaseSetupCommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  return {
    command: [command, ...args].join(" "),
    exitCode: result.status ?? 1,
    ok: result.status === 0
  };
}
