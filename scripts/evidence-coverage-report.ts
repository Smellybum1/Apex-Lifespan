import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import {
  summarizeEvidenceCoverage,
  summarizeEvidenceCoverageClaimReview
} from "@/lib/evidence-coverage";

async function main() {
  const claimId = readClaimId(process.argv.slice(2));
  const data = await getEvidenceDashboardData();

  if (claimId) {
    const summary = summarizeEvidenceCoverageClaimReview(data, claimId);

    if (!summary.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const summary = summarizeEvidenceCoverage(data);

  console.log(JSON.stringify(summary, null, 2));
}

function readClaimId(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--claim") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--claim requires a claim id.");
      }

      return value;
    }

    if (arg.startsWith("--claim=")) {
      const value = arg.slice("--claim=".length).trim();

      if (!value) {
        throw new Error("--claim requires a claim id.");
      }

      return value;
    }

    throw new Error(`Unknown coverage review argument: ${arg}`);
  }

  return undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
