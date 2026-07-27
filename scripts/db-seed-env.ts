import { execSync } from "node:child_process";

import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const envFile = readEnvFileArg(process.argv.slice(2));
  const env = mergeEnv(process.env, loadEnvFile(envFile).env);

  await withProcessEnv(env, async () => {
    execSync("npx tsx prisma/seed.ts", {
      env: process.env as NodeJS.ProcessEnv,
      stdio: "inherit"
    });
  });
}

function readEnvFileArg(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      const value = args[index + 1]?.trim();
      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      return value;
    }

    if (arg.startsWith("--env-file=")) {
      const value = arg.slice("--env-file=".length).trim();
      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      return value;
    }
  }

  throw new Error("Usage: npx tsx scripts/db-seed-env.ts --env-file <path>");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
