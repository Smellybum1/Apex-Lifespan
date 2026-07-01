import { describe, expect, it } from "vitest";

import { buildScoreUpdateDraft } from "@/lib/score-update-draft";
import { buildScoreWorklistReport } from "@/lib/score-worklist";
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

describe("score update draft", () => {
  it("builds operator form fields and rationale from a ready scoring row", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const readyClaim: Claim = {
      ...sourceBackedClaim,
      evidenceGrade: "Insufficient until source packets are reviewed.",
      id: "score-draft-ready"
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [readyClaim]
      },
      { limit: 1 }
    );
    const draft = buildScoreUpdateDraft(report.rows[0]!);

    expect(draft.claimId).toBe("score-draft-ready");
    expect(draft.formFields).toMatchObject({
      claimId: "score-draft-ready",
      finalLabel: draft.finalLabel,
      mode: "dry-run"
    });
    expect(draft.rationale).toContain("Draft score update from local ready-to-score worklist");
    expect(draft.rationale).toContain("Citations:");
    expect(draft.rationale).toContain("Product-level AU/TGA clearance is not inferred");
  });

  it("refuses source-blocked rows", () => {
    const data = seedDashboardData();
    const sourceBackedClaim = data.claims.find((claim) => claim.keyReferenceIds.length > 0)!;
    const sourceBlockedClaim: Claim = {
      ...sourceBackedClaim,
      id: "score-draft-blocked",
      keyReferenceIds: ["missing-score-draft-reference"]
    };
    const report = buildScoreWorklistReport(
      {
        ...data,
        claims: [sourceBlockedClaim]
      },
      { limit: 1 }
    );

    expect(() => buildScoreUpdateDraft(report.rows[0]!)).toThrow("complete source work");
  });
});
