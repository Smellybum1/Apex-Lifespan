import { describe, expect, it } from "vitest";

import { summarizeEvidenceCoverage } from "@/lib/evidence-coverage";
import {
  claims,
  interventions,
  references,
  studies,
  trialWatchItems,
  safetyAlerts,
  productSignals,
  australiaRegulatoryStatuses
} from "@/lib/seed-data";
import type { EvidenceDashboardData } from "@/lib/types";

const seedDashboardData: EvidenceDashboardData = {
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

describe("evidence coverage summary", () => {
  it("reports current seed coverage without treating unreviewed drafts as complete", () => {
    expect(summarizeEvidenceCoverage(seedDashboardData)).toEqual({
      completeSourcePackets: 7,
      humanReviewedClaims: 0,
      incompleteClaims: claims.map((claim) => ({
        claimId: claim.id,
        interventionId: claim.interventionId,
        packetStatus: "complete",
        reviewStatus: "Unreviewed AI draft"
      })),
      interventionsWithClaims: 4,
      interventionsWithoutClaims: ["psyllium"],
      totalClaims: 7,
      totalInterventions: 5,
      unreviewedClaims: 7
    });
  });
});
