import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { summarizeEvidenceCoverage } from "@/lib/evidence-coverage";

async function main() {
  const data = await getEvidenceDashboardData();
  const summary = summarizeEvidenceCoverage(data);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
