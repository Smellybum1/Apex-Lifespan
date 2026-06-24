import { prisma } from "@/lib/db/prisma";
import { runProductionDatabaseConnectivityCheck } from "@/lib/production-database-connectivity";

async function main() {
  const probeRequested = process.argv.includes("--probe");
  const report = await runProductionDatabaseConnectivityCheck({
    context: {
      env: process.env
    },
    probe: probeRequested ? probeDatabase : undefined
  });

  console.log(JSON.stringify(report, null, 2));

  if (report.overall === "blocked") {
    process.exitCode = 1;
  }
}

async function probeDatabase() {
  const startedAt = Date.now();

  await prisma.$queryRaw`SELECT 1`;

  return {
    latencyMs: Date.now() - startedAt
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
