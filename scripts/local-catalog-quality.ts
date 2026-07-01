import { buildCatalogTrustSummary, formatCatalogTrustSummaryLines } from "@/lib/catalog-trust";
import { getEvidenceDashboardData } from "@/lib/data/dashboard";
import { loadEnvFile, mergeEnv, withProcessEnv } from "@/lib/env-file";
import {
  buildScoreReadinessRows,
  buildScoreReadinessSummary,
  compareScoreReadinessForScoringPass,
  formatScoreReadinessSummaryLines,
  scoreReadinessNextAction,
  scoreReadinessStateLabel
} from "@/lib/score-readiness";

async function main() {
  const args = process.argv.slice(2);
  const envFile = readOption(args, "--env-file") ?? ".env.local";
  const json = args.includes("--json");
  const env = mergeEnv(process.env, loadEnvFile(envFile).env);

  await withProcessEnv(env, async () => {
    const data = await getEvidenceDashboardData();
    const summary = buildCatalogTrustSummary(data);
    const scoreReadinessRows = buildScoreReadinessRows(data);
    const scoreReadinessSummary = buildScoreReadinessSummary(scoreReadinessRows);
    const scoreWorkRows = scoreReadinessRows
      .filter((row) => row.state !== "scored")
      .sort(compareScoreReadinessForScoringPass);

    if (json) {
      console.log(
        JSON.stringify(
          {
            catalogTrust: summary,
            scoreReadiness: {
              summary: scoreReadinessSummary,
              topWorkItems: scoreWorkRows.slice(0, 12).map((row) => ({
                claimId: row.claim.id,
                currentScore: row.currentScore,
                intervention: row.intervention?.name ?? "Unknown intervention",
                nextAction: scoreReadinessNextAction(row),
                outcome: row.claim.outcome,
                priority: row.priority,
                priorityLabel: row.priorityLabel,
                reasons: row.reasons,
                sourcePacketStatus: row.packet.completeness.status,
                state: row.state
              }))
            }
          },
          null,
          2
        )
      );
      return;
    }

    console.log(formatCatalogTrustSummaryLines(summary).join("\n"));
    console.log("\nScore readiness:");
    console.log(formatScoreReadinessSummaryLines(scoreReadinessSummary).join("\n"));
    if (scoreWorkRows.length > 0) {
      console.log("\nTop scoring work:");
      for (const row of scoreWorkRows.slice(0, 5)) {
        const score = row.currentScore === null ? "no final score" : `${row.currentScore.toFixed(1)}/10`;
        console.log(
          `- ${row.intervention?.name ?? "Unknown intervention"} / ${row.claim.outcome}: ${scoreReadinessStateLabel(row.state)}; ${score}; ${row.packet.completeness.label}; ${scoreReadinessNextAction(row)}`
        );
      }
    }

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
