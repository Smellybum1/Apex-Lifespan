import { describe, expect, it } from "vitest";

import { buildClaimScoreSuggestion } from "@/lib/score-suggestions";
import type { Claim, Reference, Study } from "@/lib/types";

describe("buildClaimScoreSuggestion", () => {
  it("suggests usable scores from complete human evidence while holding product quality conservative", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim,
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [metaAnalysis]
    });

    expect(suggestion.finalLabel).toBe("Useful for Specific Use Case");
    expect(suggestion.scores.evidenceRigor).toBe(9);
    expect(suggestion.scores.productQuality).toBe(5);
    expect(suggestion.rationale).toContain("Strongest linked study type: Meta-analysis.");
    expect(suggestion.limitations.join(" ")).toContain("Product-quality is held conservative");
  });

  it("does not turn incomplete or regulatory packets into publish-ready scores", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        claimText: "Injectable peptide claim with possible TGA regulatory warning.",
        safetyNotes: "Regulatory warning and adverse event risk."
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "extraction_pending"
      },
      studies: []
    });

    expect(suggestion.finalLabel).toBe("Regulatory Concern");
    expect(suggestion.scores.regulatoryRisk).toBe(8);
    expect(suggestion.warning).toContain("Source packet is not complete");
  });
});

const claim: Claim = {
  applicabilityNotes: "Resistance-trained adults.",
  claimText: "Creatine monohydrate can support high-intensity strength performance.",
  clinicalRelevance: "Moderate improvement in training outcomes.",
  comparator: "Placebo",
  confidenceLevel: "High",
  doseFormStudied: "Creatine monohydrate",
  durationStudied: "4-12 weeks",
  effectSize: "Moderate",
  evidenceGrade: "A",
  finalLabel: "Useful for Specific Use Case",
  id: "creatine-strength",
  interventionId: "creatine",
  keyReferenceIds: ["ref-creatine"],
  lastUpdated: "2026-07-01",
  momentum: "Stable",
  outcome: "Muscle/strength",
  populationStudied: "Adults",
  reviewStatus: "Unreviewed AI draft",
  safetyNotes: "Generally well tolerated in studied adults.",
  scores: {
    effectSize: 8,
    evidenceDirectness: 9,
    evidenceRigor: 8,
    hypePenalty: 2,
    measurability: 7,
    productQuality: 6,
    regulatoryRisk: 2,
    safety: 8
  },
  whatWouldChangeScore: "New contradictory evidence."
};

const reference: Reference = {
  id: "ref-creatine",
  identifier: "PMID:28615996",
  source: "PubMed",
  title: "Creatine meta-analysis",
  url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
  year: 2017
};

const metaAnalysis: Study = {
  adverseEvents: "No serious adverse events reported.",
  fundingConflicts: "Not extracted.",
  id: "study-creatine",
  intervention: "Creatine monohydrate",
  outcomes: ["Strength"],
  population: "Adults",
  referenceId: "ref-creatine",
  riskOfBias: "Low",
  sampleSize: "Meta-analysis",
  source: "PubMed",
  studyType: "Meta-analysis",
  title: "Creatine meta-analysis",
  year: 2017
};
