import { buildCatalogTrustSummary, formatCatalogTrustSummaryLines } from "@/lib/catalog-trust";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";

async function main() {
  const args = process.argv.slice(2);
  const envFile = readOption(args, "--env-file") ?? ".env.local";
  const json = args.includes("--json");
  const env = mergeEnv(process.env, loadEnvFile(envFile).env);

  await withProcessEnv(env, async () => {
    const data = await getEvidenceDashboardData();
    const summary = buildCatalogTrustSummary(data);

    if (json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log(formatCatalogTrustSummaryLines(summary).join("\n"));
    if (summary.nextActions.length > 0) {
      console.log("\nNext useful local work:");
      for (const action of summary.nextActions) {
        console.log(`- ${action}`);
      }
    }
  });
}

function readOption(args: string[], option: string) {
  const index = args.indexOf(option);
  if (index >= 0) {
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value.`);
    }
    return value;
  }

  const prefix = `${option}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
