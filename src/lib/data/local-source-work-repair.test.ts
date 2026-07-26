import {
  SourceCandidateDecision as DbSourceCandidateDecision,
  SourceKind as DbSourceKind,
  StudyType as DbStudyType,
  ReviewStatus as DbReviewStatus,
  type SourceCandidate as DbSourceCandidate
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { studyTypeFromCandidate } from "@/lib/data/local-source-work-repair";

function candidate(overrides: Partial<DbSourceCandidate> = {}): DbSourceCandidate {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    abstractAvailable: true,
    acceptedReferenceId: null,
    claimId: null,
    createdAt: now,
    decision: DbSourceCandidateDecision.PENDING_REVIEW,
    dedupeKey: "pubmed:1",
    discoveredAt: now,
    externalId: "1",
    id: "candidate-1",
    ingestionJobId: null,
    interventionId: null,
    metadata: null,
    publishedYear: 2024,
    query: "test query",
    region: "AU",
    reviewNote: null,
    reviewStatus: DbReviewStatus.UNREVIEWED_AI_DRAFT,
    reviewedAt: null,
    source: DbSourceKind.PUBMED,
    sourceType: null,
    title: "Untitled",
    triageReasons: [],
    triageScore: 0,
    updatedAt: now,
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    ...overrides
  };
}

describe("studyTypeFromCandidate", () => {
  it("maps a randomized controlled trial title to RANDOMIZED_CONTROLLED_TRIAL", () => {
    expect(
      studyTypeFromCandidate(
        candidate({
          title: "A randomized controlled trial of creatine in older adults"
        })
      )
    ).toBe(DbStudyType.RANDOMIZED_CONTROLLED_TRIAL);
  });

  it("maps a bare 'Clinical Trial' publication type to CLINICAL_TRIAL_RECORD, not RCT", () => {
    const result = studyTypeFromCandidate(
      candidate({
        metadata: { publicationTypes: ["Clinical Trial", "Journal Article"] },
        title: "Open-label evaluation of creatine supplementation in older adults"
      })
    );

    expect(result).toBe(DbStudyType.CLINICAL_TRIAL_RECORD);
    expect(result).not.toBe(DbStudyType.RANDOMIZED_CONTROLLED_TRIAL);
  });

  it("still reaches RANDOMIZED_CONTROLLED_TRIAL when a clinical trial is randomized", () => {
    expect(
      studyTypeFromCandidate(
        candidate({
          metadata: {
            publicationTypes: ["Clinical Trial", "Randomized Controlled Trial"]
          },
          title: "Creatine supplementation in older adults"
        })
      )
    ).toBe(DbStudyType.RANDOMIZED_CONTROLLED_TRIAL);
  });

  it("treats a placebo-controlled trial as randomized", () => {
    expect(
      studyTypeFromCandidate(
        candidate({
          title: "A double-blind, placebo-controlled trial of vitamin D"
        })
      )
    ).toBe(DbStudyType.RANDOMIZED_CONTROLLED_TRIAL);
  });

  it("maps a meta-analysis title to META_ANALYSIS", () => {
    expect(
      studyTypeFromCandidate(
        candidate({
          title: "Effects of omega-3: a systematic review and meta-analysis"
        })
      )
    ).toBe(DbStudyType.META_ANALYSIS);
  });

  it("maps a systematic review title to SYSTEMATIC_REVIEW", () => {
    expect(
      studyTypeFromCandidate(
        candidate({ title: "A systematic review of magnesium and sleep quality" })
      )
    ).toBe(DbStudyType.SYSTEMATIC_REVIEW);
  });

  it("keeps ClinicalTrials.gov candidates as CLINICAL_TRIAL_RECORD", () => {
    expect(
      studyTypeFromCandidate(
        candidate({
          source: DbSourceKind.CLINICALTRIALS_GOV,
          title: "A meta-analysis flavoured registry title"
        })
      )
    ).toBe(DbStudyType.CLINICAL_TRIAL_RECORD);
  });

  it("falls back to UNCLASSIFIED for unclassifiable sources", () => {
    const result = studyTypeFromCandidate(
      candidate({
        metadata: { publicationTypes: ["Journal Article"] },
        title: "Nutritional considerations for healthy ageing"
      })
    );

    expect(result).toBe(DbStudyType.UNCLASSIFIED);
    // Both previous stopgaps asserted a design we had not established:
    // SYSTEMATIC_REVIEW inflated rigor to 8, and CASE_REPORT told readers the
    // source was "a single unreplicated observation".
    expect(result).not.toBe(DbStudyType.SYSTEMATIC_REVIEW);
    expect(result).not.toBe(DbStudyType.CASE_REPORT);
  });
});
