import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { summarizeAustraliaRegulatoryVerification } from "@/lib/australia-regulatory-verification";

async function main() {
  const data = await getEvidenceDashboardData();
  const summary = summarizeAustraliaRegulatoryVerification(data);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
