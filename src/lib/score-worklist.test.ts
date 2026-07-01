import { describe, expect, it } from "vitest";

import {
  buildScoreWorklistReport,
  formatScoreWorklistReportLines
} from "@/lib/score-worklist";
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
import type { Claim, EvidenceDashboardData } from "@/lib/types";

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

describe("score worklist", () => {
  it("builds a read-only scoring run sheet with suggestions and linked citations", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const readyClaim: Claim = {
      ...sourceBackedClaim!,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "score-ready-test"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [readyClaim]
      },
      { limit: 5 }
    );

    expect(report.summary.readyToScore).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      claimId: "score-ready-test",
      disposition: "score-now",
      state: "ready_to_score"
    });
    expect(report.rows[0].suggestion.compositeScore).toBeGreaterThan(0);
    expect(report.rows[0].suggestion.limitations.join(" ")).toContain("Operator");
    expect(report.rows[0].references.length).toBeGreaterThan(0);
  });

  it("formats and filters the local score worklist", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const defaultLookingClaim: Claim = {
      ...sourceBackedClaim,
      evidenceGrade: "Starter score review fixture",
      id: "default-score-test",
      scores: {
        effectSize: 3,
        evidenceDirectness: 3,
        evidenceRigor: 3,
        hypePenalty: 7,
        measurability: 3,
        productQuality: 4,
        regulatoryRisk: 7,
        safety: 4
      }
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [defaultLookingClaim]
      },
      {
        state: "default_score_review"
      }
    );
    const lines = formatScoreWorklistReportLines(report).join("\n");

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].currentScoreLabel).toContain("3.1 Weak");
    expect(lines).toContain("Read-only local score worklist");
    expect(lines).toContain("Default-looking score");
    expect(lines).toContain("Operator: Open /operator > Score tools");
  });

  it("orders ready scoring work before source-blocked extraction by default", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0);

    expect(sourceBackedClaim).toBeDefined();

    const readyClaim: Claim = {
      ...sourceBackedClaim!,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "ready-score-first"
    };
    const sourceBlockedClaim: Claim = {
      ...sourceBackedClaim!,
      finalLabel: "Core Evidence-Based",
      id: "source-blocked-second",
      keyReferenceIds: ["missing-reference-for-score-worklist-order"],
      scores: {
        effectSize: 9,
        evidenceDirectness: 9,
        evidenceRigor: 9,
        hypePenalty: 1,
        measurability: 9,
        productQuality: 8,
        regulatoryRisk: 1,
        safety: 9
      }
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [sourceBlockedClaim, readyClaim]
      },
      { limit: 2 }
    );

    expect(report.rows.map((row) => [row.claimId, row.state])).toEqual([
      ["ready-score-first", "ready_to_score"],
      ["source-blocked-second", "source_blocked"]
    ]);
    expect(formatScoreWorklistReportLines(report).join("\n")).toContain(
      "Order: score-review and ready-to-score rows first"
    );
  });
});
