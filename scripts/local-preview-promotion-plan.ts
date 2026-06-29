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
    const plan = {
      attentionItems: summary.previewAttentionItems,
      dataSource: data.dataSource,
      localOnly: true,
      nextActions: summary.nextActions,
      note:
        "This is a local-only preview promotion plan. It performs no preview/production writes, migrations, deploys, pushes, or seeds.",
      recommendedChecks: [
        "npx tsx scripts/local-catalog-quality.ts",
        "npx tsx scripts/verify-local-trial-leads.ts --summary",
        "npm run test",
        "npm run lint",
        "npm run typecheck",
        "npm run build"
      ],
      summary
    };

    if (json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    console.log(plan.note);
    console.log("");
    console.log(formatCatalogTrustSummaryLines(summary).join("\n"));
    console.log("");
    console.log("Recommended checks before asking for preview promotion:");
    for (const check of plan.recommendedChecks) {
      console.log(`- ${check}`);
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
// Legacy/reference process script. Not part of ordinary local product work.
// Use only when explicitly planning preview promotion.
