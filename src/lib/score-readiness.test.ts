import { describe, expect, it } from "vitest";

import {
  buildScoreReadinessRows,
  buildScoreReadinessSummary,
  formatScoreReadinessSummaryLines,
  scoreReadinessNextAction
} from "@/lib/score-readiness";
import {
  australiaRegulatoryStatuses,
  claims,
  interventions,
  productSignals,
  references,
  safetyAlerts,
  studies,
  trialWatchItems
} from "@/lib/seed-data";
import type { EvidenceDashboardData } from "@/lib/types";

function seedDashboardData(): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses,
    claims,
    dataSource: "seed",
    interventions,
    productSignals,
    references,
    safetyAlerts,
    studies,
    trialWatchItems
  };
}

describe("score readiness", () => {
  it("summarizes score-ready and default-looking score work", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const scoreReadyClaim = {
      ...sourceBackedClaim!,
      id: "score-ready-test",
      evidenceGrade: "Insufficient until source packets are reviewed."
    };
    const starterScoreClaim = {
      ...sourceBackedClaim!,
      id: "starter-score-test",
      evidenceGrade: "Starter score review fixture",
      finalLabel: "Insufficient Evidence" as const,
      scores: {
        evidenceDirectness: 3,
        evidenceRigor: 3,
        effectSize: 3,
        safety: 4,
        regulatoryRisk: 7,
        productQuality: 4,
        hypePenalty: 7,
        measurability: 3
      }
    };
    const rows = buildScoreReadinessRows({
      ...data,
      claims: [...data.claims, scoreReadyClaim, starterScoreClaim],
      claimScoreSnapshots: []
    });
    const summary = buildScoreReadinessSummary(rows);
    const scoreReadyRow = rows.find((row) => row.claim.id === scoreReadyClaim.id);
    const starterScoreRow = rows.find((row) => row.claim.id === starterScoreClaim.id);

    expect(scoreReadyRow?.state).toBe("ready_to_score");
    expect(scoreReadyRow?.reasons).toContain("source packet complete");
    expect(scoreReadinessNextAction(scoreReadyRow!)).toContain("assign dimension scores");
    expect(starterScoreRow?.state).toBe("default_score_review");
    expect(starterScoreRow?.currentScore).toBe(3.1);
    expect(summary.readyToScore).toBeGreaterThan(0);
    expect(summary.defaultLookingPublicScores).toBe(1);
    expect(formatScoreReadinessSummaryLines(summary).join("\n")).toContain(
      "Default-looking public scores: 1"
    );
  });
});
