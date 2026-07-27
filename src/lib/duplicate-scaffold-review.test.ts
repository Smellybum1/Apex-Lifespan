import { describe, expect, it } from "vitest";

import {
  buildDuplicateScaffoldReview,
  summarizeDuplicateScaffoldReview
} from "@/lib/duplicate-scaffold-review";
import type { Claim, EvidenceDashboardData, Intervention } from "@/lib/types";

function intervention(): Intervention {
  return {
    category: "Fatty acid",
    commonForms: ["Softgel"],
    evidenceSummary: "Summary.",
    id: "omega-3",
    interactionSummary: "Interactions.",
    lastReviewed: "2026-01-01",
    name: "Omega-3 EPA/DHA",
    regulatoryStatus: "Supplement.",
    safetySummary: "Safety.",
    slug: "omega-3",
    synonyms: ["fish oil"]
  };
}

function claim(overrides: Partial<Claim> & Pick<Claim, "id" | "evidenceGrade">): Claim {
  return {
    applicabilityNotes: "Applies.",
    claimText: "Claim text.",
    clinicalRelevance: "Relevance.",
    comparator: "Placebo",
    confidenceLevel: "Moderate",
    doseFormStudied: "Softgel",
    durationStudied: "12 weeks",
    effectSize: "Moderate",
    finalLabel: "Useful for Specific Use Case",
    interventionId: "omega-3",
    keyReferenceIds: [],
    lastUpdated: "2026-01-01",
    momentum: "Stable",
    outcome: "LDL/ApoB/lipids",
    populationStudied: "Adults",
    reviewStatus: "Human reviewed",
    safetyNotes: "Notes.",
    scores: {
      effectSize: 6,
      evidenceDirectness: 8,
      evidenceRigor: 7,
      hypePenalty: 4,
      measurability: 9,
      productQuality: 6,
      regulatoryRisk: 2,
      safety: 6
    },
    whatWouldChangeScore: "More trials.",
    ...overrides
  };
}

function data(claims: Claim[]): EvidenceDashboardData {
  return {
    australiaRegulatoryStatuses: [],
    claims,
    dataSource: "seed",
    interventions: [intervention()],
    productSignals: [],
    references: [],
    safetyAlerts: [],
    studies: [],
    trialWatchItems: []
  };
}

describe("buildDuplicateScaffoldReview", () => {
  it("recommends retire when all scaffold references are already covered", () => {
    const reviews = buildDuplicateScaffoldReview(
      data([
        claim({
          id: "omega-3-triglycerides",
          evidenceGrade: "Useful for a specific lipid endpoint.",
          claimText: "Triglyceride lowering.",
          keyReferenceIds: ["ref-a", "ref-b", "ref-c"]
        }),
        claim({
          id: "scaffold-1",
          evidenceGrade: "Draft lead",
          finalLabel: "Insufficient Evidence",
          reviewStatus: "Unreviewed AI draft",
          claimText: "Omega-3 EPA/DHA has accepted source leads for ldl/apob/lipids that need structured evidence review.",
          keyReferenceIds: ["ref-a", "ref-b"]
        })
      ])
    );

    expect(reviews).toHaveLength(1);
    expect(reviews[0].scaffold.id).toBe("scaffold-1");
    expect(reviews[0].realClaims[0].id).toBe("omega-3-triglycerides");
    expect(reviews[0].recommendation).toBe("retire");
    expect(reviews[0].uniqueReferenceIds).toEqual([]);
    expect(reviews[0].sharedReferenceCount).toBe(2);
  });

  it("recommends merge-then-retire and lists references unique to the scaffold", () => {
    const reviews = buildDuplicateScaffoldReview(
      data([
        claim({
          id: "omega-3-triglycerides",
          evidenceGrade: "Useful for a specific lipid endpoint.",
          keyReferenceIds: ["ref-a"]
        }),
        claim({
          id: "scaffold-1",
          evidenceGrade: "Draft lead",
          keyReferenceIds: ["ref-a", "ref-new-1", "ref-new-2"]
        })
      ])
    );

    expect(reviews).toHaveLength(1);
    expect(reviews[0].recommendation).toBe("merge-then-retire");
    expect(reviews[0].uniqueReferenceIds.sort()).toEqual(["ref-new-1", "ref-new-2"]);
    expect(reviews[0].sharedReferenceCount).toBe(1);
  });

  it("ignores outcomes without both a scaffold and a real claim", () => {
    const reviews = buildDuplicateScaffoldReview(
      data([
        claim({ id: "real-only", evidenceGrade: "Useful for a specific lipid endpoint." }),
        claim({
          id: "scaffold-only",
          evidenceGrade: "Draft lead",
          outcome: "Blood pressure"
        })
      ])
    );

    expect(reviews).toHaveLength(0);
  });

  it("summarizes retire vs merge-then-retire counts", () => {
    const reviews = buildDuplicateScaffoldReview(
      data([
        claim({ id: "real-a", evidenceGrade: "Scored.", keyReferenceIds: ["r1"] }),
        claim({ id: "scaffold-a", evidenceGrade: "Draft lead", keyReferenceIds: ["r1"] }),
        claim({
          id: "real-b",
          evidenceGrade: "Scored.",
          outcome: "Blood pressure",
          keyReferenceIds: ["r2"]
        }),
        claim({
          id: "scaffold-b",
          evidenceGrade: "Draft lead",
          outcome: "Blood pressure",
          keyReferenceIds: ["r2", "r3"]
        })
      ])
    );

    const summary = summarizeDuplicateScaffoldReview(reviews);
    expect(summary.total).toBe(2);
    expect(summary.retire).toBe(1);
    expect(summary.mergeThenRetire).toBe(1);
  });
});
