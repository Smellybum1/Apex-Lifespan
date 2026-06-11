import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import {
  summarizeEvidenceCoverage,
  summarizeEvidenceCoverageClaimReview,
  summarizeEvidenceCoverageReviewReport
} from "@/lib/evidence-coverage";

async function main() {
  const args = readCoverageReviewArgs(process.argv.slice(2));
  const data = await getEvidenceDashboardData();

  if (args.claimId) {
    const summary = summarizeEvidenceCoverageClaimReview(data, args.claimId);

    if (!summary.found) {
      process.exitCode = 1;
    }

    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const summary = summarizeEvidenceCoverage(data);

  console.log(
    JSON.stringify(
      args.compactSummary ? summarizeEvidenceCoverageReviewReport(summary) : summary,
      null,
      2
    )
  );
}

interface CoverageReviewCliArgs {
  claimId?: string;
  compactSummary: boolean;
}

function readCoverageReviewArgs(args: string[]): CoverageReviewCliArgs {
  const parsed: CoverageReviewCliArgs = {
    compactSummary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary") {
      parsed.compactSummary = true;
      continue;
    }

    if (arg === "--claim") {
      const value = args[index + 1]?.trim();

      if (!value) {
        throw new Error("--claim requires a claim id.");
      }

      parsed.claimId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--claim=")) {
      const value = arg.slice("--claim=".length).trim();

      if (!value) {
        throw new Error("--claim requires a claim id.");
      }

      parsed.claimId = value;
      continue;
    }

    throw new Error(`Unknown coverage review argument: ${arg}`);
  }

  if (parsed.compactSummary && parsed.claimId) {
    throw new Error("--summary cannot be combined with --claim.");
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
