import { describe, expect, it } from "vitest";

import { confidenceChange, deriveClaimConfidence } from "@/lib/claim-confidence";
import type { ClaimSourcePacket, EvidenceDepthSummary } from "@/lib/source-packet";
import type { Claim } from "@/lib/types";

function depth(overrides: Partial<EvidenceDepthSummary> = {}): EvidenceDepthSummary {
  return {
    animalMechanisticStudies: 0,
    badges: [],
    caseReports: 0,
    clinicalTrialRecords: 0,
    directHumanTrials: 0,
    metaAnalyses: 0,
    observationalCohorts: 0,
    randomizedControlledTrials: 0,
    regulatorySafetyWarnings: 0,
    reviewPositionStandSources: 0,
    sourcePackets: 1,
    systematicReviews: 0,
    totalExtractedStudies: 0,
    ...overrides
  };
}

function packet(overrides: Partial<EvidenceDepthSummary> = {}, extractedReferences = 10) {
  return {
    completeness: {
      detail: "",
      extractedReferences,
      label: "",
      missingReferences: 0,
      nextStep: "",
      pendingReferences: 0,
      status: "complete",
      totalReferences: extractedReferences
    },
    evidenceDepth: depth(overrides),
    missingReferenceIds: [],
    pendingReferences: [],
    referenceIds: [],
    references: [],
    studies: []
  } as unknown as ClaimSourcePacket;
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    claimText: "Creatine supplementation increases lean mass in resistance-trained adults.",
    doseFormStudied: "5 g/day creatine monohydrate",
    durationStudied: "8-12 weeks",
    effectSize: "Roughly 1 kg additional lean mass versus placebo",
    finalLabel: "Core Evidence-Based",
    outcome: "Muscle/strength",
    populationStudied: "Resistance-trained adults aged 18-45",
    reviewStatus: "Human reviewed",
    ...overrides
  } as unknown as Claim;
}

describe("deriveClaimConfidence", () => {
  it("refuses to lift a pipeline placeholder no matter what is linked to it", () => {
    // The bug this exists to avoid: 552 placeholder rows scored 7.5 because the
    // pipeline read the quality of their linked papers as the quality of a claim
    // nobody had written.
    const result = deriveClaimConfidence({
      claim: claim({
        claimText: "Creatine has accepted source leads for cognition that need structured evidence review.",
        effectSize: "Unknown",
        populationStudied: "Manual review required"
      }),
      packet: packet({ metaAnalyses: 12, systematicReviews: 7, totalExtractedStudies: 40 })
    });

    expect(result.confidenceLevel).toBe("Very low");
    expect(result.blockedReason).toContain("placeholder");
  });

  it("refuses a conclusion that never states what it found", () => {
    // `classifyClaim` already catches the "Manual review required" population,
    // so this is the case that slips past it: a claim that reads like a
    // conclusion but has no effect size behind it.
    const result = deriveClaimConfidence({
      claim: claim({ effectSize: "Unknown" }),
      packet: packet({ metaAnalyses: 4, systematicReviews: 4, totalExtractedStudies: 20 })
    });

    expect(result.confidenceLevel).toBe("Very low");
    expect(result.blockedReason).toContain("effect size");
  });

  it("will not raise a claim already labelled Insufficient Evidence", () => {
    // Regression: Whey protein / Mortality-lifespan reached Moderate off a
    // refeeding-syndrome trial, a diarrhea trial and a strength meta-analysis —
    // none of which measured mortality. This function counts what the linked
    // studies are, never what they measured, so the label is the backstop.
    const result = deriveClaimConfidence({
      claim: claim({
        claimText: "Direct lifespan extension.",
        effectSize: "No lifespan or mortality effect established in this row.",
        finalLabel: "Insufficient Evidence"
      }),
      packet: packet({
        metaAnalyses: 1,
        randomizedControlledTrials: 1,
        totalExtractedStudies: 3
      })
    });

    expect(result.confidenceLevel).toBe("Very low");
    expect(result.blockedReason).toContain("Insufficient Evidence");
  });

  it("stays at the floor when references are linked but nothing is extracted", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({ totalExtractedStudies: 0 }, 19)
    });

    expect(result.confidenceLevel).toBe("Very low");
    expect(result.reason).toContain("design is unknown");
  });

  it("stays at the floor when nothing extracted is a trial or review", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({ observationalCohorts: 6, totalExtractedStudies: 6 })
    });

    expect(result.confidenceLevel).toBe("Very low");
  });

  it("reaches High only on repeated review-level evidence", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({
        metaAnalyses: 2,
        randomizedControlledTrials: 6,
        systematicReviews: 1,
        totalExtractedStudies: 9
      })
    });

    expect(result.confidenceLevel).toBe("High");
  });

  it("holds at Moderate when there is review-level evidence but little of it", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({
        metaAnalyses: 1,
        randomizedControlledTrials: 2,
        totalExtractedStudies: 3
      })
    });

    expect(result.confidenceLevel).toBe("Moderate");
  });

  it("reaches Low on trials alone", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({ randomizedControlledTrials: 2, totalExtractedStudies: 2 })
    });

    expect(result.confidenceLevel).toBe("Low");
  });

  it("does not raise confidence for a claim with no packet at all", () => {
    expect(deriveClaimConfidence({ claim: claim() }).confidenceLevel).toBe("Very low");
  });

  it("explains every verdict", () => {
    const result = deriveClaimConfidence({
      claim: claim(),
      packet: packet({ randomizedControlledTrials: 2, totalExtractedStudies: 2 })
    });

    expect(result.reason.trim().length).toBeGreaterThan(0);
  });
});

describe("confidenceChange", () => {
  it("reports the direction a backfill would move a claim", () => {
    expect(confidenceChange("Very low", "Moderate")).toBe("raised");
    expect(confidenceChange("High", "Low")).toBe("lowered");
    expect(confidenceChange("Low", "Low")).toBe("unchanged");
  });
});
