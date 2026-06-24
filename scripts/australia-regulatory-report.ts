import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { summarizeAustraliaRegulatoryVerification } from "@/lib/australia-regulatory-verification";
import { summarizeRegionalSafetyRegulatoryReviewGaps } from "@/lib/safety-domains";

async function main() {
  const data = await getEvidenceDashboardData();
  const summary = summarizeAustraliaRegulatoryVerification(data);

  console.log(
    JSON.stringify(
      {
        ...summary,
        regionalSafetyRegulatoryReview: summarizeRegionalSafetyRegulatoryReviewGaps({
          australiaRegulatoryStatuses: data.australiaRegulatoryStatuses,
          safetyAlerts: data.safetyAlerts
        })
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
