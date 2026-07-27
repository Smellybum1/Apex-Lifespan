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

  it("does not promote ordinary supplement product-status caveats into regulatory concern labels", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        safetyNotes:
          "Do not infer product safety, interaction safety, or AU/TGA clearance from this intervention evidence.",
        whatWouldChangeScore:
          "Product-level AU/TGA status would improve product confidence, but the intervention evidence is otherwise ordinary supplement evidence."
      },
      references: [
        {
          ...reference,
          title: "Effect of Ashwagandha extract on sleep: a systematic review and meta-analysis"
        }
      ],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          title: "Effect of Ashwagandha extract on sleep: a systematic review and meta-analysis"
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Useful for Specific Use Case");
    expect(suggestion.scores.regulatoryRisk).toBe(4);
    expect(suggestion.rationale.join(" ")).toContain("No high-signal regulatory warning");
  });

  it("keeps official regulatory source packets conservative even without peptide wording", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        finalLabel: "Insufficient Evidence"
      },
      references: [
        {
          ...reference,
          source: "TGA",
          title: "Therapeutic Goods Administration safety alert"
        }
      ],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          title: "Therapeutic Goods Administration safety alert"
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Regulatory Concern");
    expect(suggestion.scores.regulatoryRisk).toBe(8);
  });

  it("keeps TGA peptide warning packets as regulatory concerns", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        claimText: "CJC-1295 peptide lifespan claim.",
        finalLabel: "Insufficient Evidence"
      },
      references: [
        {
          ...reference,
          source: "TGA",
          title: "TGA warning on risks of importing unapproved peptide products"
        }
      ],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          intervention: "CJC-1295",
          studyType: "Regulatory safety warning",
          title: "TGA warning on risks of importing unapproved peptide products"
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Regulatory Concern");
    expect(suggestion.scores.regulatoryRisk).toBe(8);
  });

  it("keeps complete animal-only packets as speculative instead of reasonable experiments", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        claimText: "Fadogia agrestis hormone support claim.",
        finalLabel: "Insufficient Evidence"
      },
      references: [
        {
          ...reference,
          title: "Effects of Fadogia agrestis on testosterone and testicular function in rats"
        }
      ],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          population: "Preclinical models; limited direct human extrapolation.",
          riskOfBias: "Animal evidence only; human outcome claims remain uncertain.",
          studyType: "Animal study",
          title: "Effects of Fadogia agrestis on testosterone and testicular function in rats"
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Speculative Watchlist");
    expect(suggestion.scores.evidenceDirectness).toBeLessThan(5);
    expect(suggestion.scores.evidenceRigor).toBeLessThan(4);
  });

  it("does not treat incomplete adverse-event reporting as a safety concern by itself", () => {
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
      studies: [
        {
          ...metaAnalysis,
          adverseEvents: "Adverse events were not consistently reported."
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Useful for Specific Use Case");
    expect(suggestion.scores.safety).toBe(7);
    expect(suggestion.rationale.join(" ")).toContain("No local safety warning wording");
  });

  it("keeps explicit toxicity or warning language safety-conservative", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        safetyNotes: "Potential liver toxicity warning and serious adverse event risk."
      },
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

    expect(suggestion.finalLabel).toBe("Safety Concern");
    expect(suggestion.scores.safety).toBe(4);
  });

  it("does not flag Safety Concern when mortality is an efficacy endpoint", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        claimText: "Omega-3 EPA/DHA and blood lipid markers.",
        finalLabel: "Insufficient Evidence",
        outcome: "LDL/ApoB/lipids",
        safetyNotes: "Generally well tolerated."
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          title:
            "Omega-3 polyunsaturated fatty acids reduce cardiac death and myocardial infarction in secondary prevention."
        }
      ]
    });

    expect(suggestion.finalLabel).not.toBe("Safety Concern");
    expect(suggestion.scores.safety).toBeGreaterThan(4);
  });

  it("still flags Safety Concern when the intervention increases mortality/harm", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        finalLabel: "Insufficient Evidence",
        safetyNotes: "Higher doses increased risk of death in the trial."
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          title: "Supplement associated with increased mortality."
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Safety Concern");
    expect(suggestion.scores.safety).toBe(4);
  });

  it("does not flag neutral 'serious adverse events' reporting boilerplate", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        claimText: "Omega-3 EPA/DHA and blood lipid markers.",
        finalLabel: "Insufficient Evidence",
        outcome: "LDL/ApoB/lipids",
        safetyNotes: "Generally well tolerated."
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          adverseEvents:
            "Serious adverse events were considered, but exact adverse-event details were not captured in local metadata.",
          title: "Omega-3 fatty acids for the prevention of cardiovascular disease."
        }
      ]
    });

    expect(suggestion.finalLabel).not.toBe("Safety Concern");
    expect(suggestion.scores.safety).toBeGreaterThan(4);
  });

  it("still flags serious adverse events when they are more frequent with the intervention", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        finalLabel: "Insufficient Evidence"
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          adverseEvents: "Serious adverse events were more frequent in the supplement group."
        }
      ]
    });

    expect(suggestion.finalLabel).toBe("Safety Concern");
    expect(suggestion.scores.safety).toBe(4);
  });

  it("does not flag a bare cardiac-event term with no harm direction", () => {
    const suggestion = buildClaimScoreSuggestion({
      claim: {
        ...claim,
        finalLabel: "Insufficient Evidence",
        safetyNotes: "Generally well tolerated."
      },
      references: [reference],
      sourcePacket: {
        claimId: claim.id,
        current: true,
        referenceIds: [reference.id],
        reviewStatus: "Unreviewed AI draft",
        sourcePacketId: "packet-1",
        status: "complete"
      },
      studies: [
        {
          ...metaAnalysis,
          title: "Arrhythmia monitoring methods in cardiology research."
        }
      ]
    });

    expect(suggestion.finalLabel).not.toBe("Safety Concern");
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
