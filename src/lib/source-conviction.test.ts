import { describe, expect, it } from "vitest";

import {
  assessSourceCandidateConviction,
  getSourceConvictionRubric
} from "@/lib/source-conviction";
import type { SourceCandidate } from "@/lib/types";

describe("source conviction", () => {
  it("scores traceable PubMed systematic review candidates higher", () => {
    const assessment = assessSourceCandidateConviction(
      candidate({
        abstractAvailable: true,
        publishedYear: 2024,
        source: "PubMed",
        sourceType: "Systematic review",
        title: "Magnesium supplementation and sleep quality: a systematic review",
        triageScore: 88
      })
    );

    expect(assessment.label).toBe("High");
    expect(assessment.rubricVersion).toBe(getSourceConvictionRubric().version);
    expect(assessment.scoreBreakdown).toMatchObject({
      abstractAvailability: 8,
      cappedScore: 100,
      recency: 8,
      sourceReputation: 30,
      studyDesign: 30,
      titleQueryOverlapPenalty: 0,
      traceability: 14,
      triageSignal: 11
    });
    expect(assessment.sourceReputationLabel).toBe("high-repute");
    expect(assessment.triageRecommendation).toBe("review-first");
    expect(assessment.triageRationale).toEqual(
      expect.arrayContaining([
        "high-repute source with high conviction (100/100).",
        "Strong traceability and relevance signals make this a first-pass review candidate."
      ])
    );
    expect(assessment.positiveFactors).toEqual(
      expect.arrayContaining([
        "PubMed-indexed biomedical source",
        "systematic review/meta-analysis design",
        "candidate has strong identifier and URL traceability",
        "abstract is available for review"
      ])
    );
    expect(assessment.uncertainty).toContain("not an automatic evidence grade");
  });

  it("scores weakly traceable low-overlap candidates lower and explains limitations", () => {
    const assessment = assessSourceCandidateConviction(
      candidate({
        abstractAvailable: false,
        externalId: "",
        publishedYear: 2001,
        query: "magnesium sleep human",
        source: "ClinicalTrials.gov",
        sourceType: "Unknown record",
        title: "Unrelated sports nutrition registry entry",
        triageScore: 5,
        url: ""
      })
    );

    expect(assessment.label).toBe("Very low");
    expect(assessment.scoreBreakdown).toMatchObject({
      abstractAvailability: 0,
      cappedScore: 21,
      recency: 2,
      sourceReputation: 24,
      studyDesign: 6,
      titleQueryOverlapPenalty: 12,
      traceability: 0,
      triageSignal: 1
    });
    expect(assessment.sourceReputationLabel).toBe("moderate-repute");
    expect(assessment.triageRecommendation).toBe("hold-or-reject");
    expect(assessment.triageRationale).toEqual(
      expect.arrayContaining([
        "moderate-repute source with very low conviction (21/100).",
        "Weak relevance or low conviction means this should not support the packet by itself."
      ])
    );
    expect(assessment.limitations).toEqual(
      expect.arrayContaining([
        "candidate traceability is incomplete",
        "abstract was not available from the candidate metadata",
        "title/query overlap is weak; review relevance before relying on it"
      ])
    );
  });

  it("exposes the scoring rubric for operator-facing explanations", () => {
    const rubric = getSourceConvictionRubric();

    expect(rubric.maxScore).toBe(100);
    expect(rubric.components.map((component) => component.id)).toEqual([
      "sourceReputation",
      "studyDesign",
      "traceability",
      "recency",
      "abstractAvailability",
      "triageSignal",
      "titleQueryOverlapPenalty"
    ]);
    expect(rubric.sourceReputationWeights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "high-repute",
          points: 30,
          source: "PubMed"
        }),
        expect.objectContaining({
          label: "moderate-repute",
          points: 24,
          source: "ClinicalTrials.gov"
        })
      ])
    );
    expect(rubric.guardrails).toEqual(
      expect.arrayContaining([
        "Higher conviction does not accept a candidate, write extraction rows, mark claim review, or promote public evidence.",
        "Product-level AU/TGA status is never inferred from source conviction."
      ])
    );
  });
});

function candidate(overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return {
    abstractAvailable: true,
    decision: "Pending review",
    dedupeKey: "pubmed|au|magnesium|123",
    externalId: "123",
    metadata: {},
    query: "magnesium sleep human",
    region: "AU",
    reviewStatus: "Unreviewed AI draft",
    source: "PubMed",
    title: "Magnesium supplementation and sleep quality",
    triageReasons: ["human evidence"],
    triageScore: 50,
    url: "https://pubmed.ncbi.nlm.nih.gov/123/",
    ...overrides
  };
}
