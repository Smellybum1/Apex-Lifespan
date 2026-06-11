import { spawnSync } from "node:child_process";

const BUILD_TIME_DATABASE_URL =
  "postgresql://prisma-generate:prisma-generate@127.0.0.1:5432/prisma_generate?schema=public";

const command = process.platform === "win32" ? "cmd.exe" : "npx";
const args = process.platform === "win32" ? ["/d", "/s", "/c", "npx prisma generate"] : ["prisma", "generate"];
const result = spawnSync(command, args, {
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || BUILD_TIME_DATABASE_URL
  },
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
