import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  sourceCandidateFindMany: vi.fn(),
  sourceCandidateGroupBy: vi.fn(),
  sourceCandidateUpdate: vi.fn(),
  sourceCandidateUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sourceCandidate: {
      findMany: prismaMocks.sourceCandidateFindMany,
      groupBy: prismaMocks.sourceCandidateGroupBy,
      update: prismaMocks.sourceCandidateUpdate,
      upsert: prismaMocks.sourceCandidateUpsert
    },
    $transaction: prismaMocks.transaction
  }
}));

import {
  listSourceCandidateReviewQueue,
  recordSourceCandidateDecision,
  summarizeSourceCandidateBacklog,
  upsertSourceCandidateDrafts
} from "@/lib/data/source-candidates";
import type { SourceCandidate } from "@/lib/types";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.sourceCandidateUpsert.mockImplementation((args) => ({
    id: args.where.dedupeKey
  }));
  prismaMocks.transaction.mockImplementation(async (operations) => operations);
});

describe("upsertSourceCandidateDrafts", () => {
  it("skips Prisma work when there are no candidates", async () => {
    await expect(upsertSourceCandidateDrafts([])).resolves.toEqual({
      received: 0,
      upserted: 0
    });

    expect(prismaMocks.sourceCandidateUpsert).not.toHaveBeenCalled();
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
  });

  it("creates unreviewed pending PubMed candidates from mapped drafts", async () => {
    const candidate = sourceCandidate({
      metadata: {
        journal: "Example Journal",
        omitMe: undefined,
        nested: {
          keepMe: true,
          omitMe: undefined
        },
        values: ["a", undefined, null]
      }
    });

    await expect(upsertSourceCandidateDrafts([candidate])).resolves.toEqual({
      received: 1,
      upserted: 1
    });

    expect(prismaMocks.sourceCandidateUpsert).toHaveBeenCalledWith({
      where: {
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength"
      },
      create: expect.objectContaining({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        source: "PUBMED",
        externalId: "28615996",
        query: "creatine",
        region: "AU",
        title: "Creatine position stand",
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        publishedYear: 2017,
        sourceType: "Review",
        abstractAvailable: true,
        triageScore: 80,
        triageReasons: ["Title matches query"],
        decision: "PENDING_REVIEW",
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        interventionId: "creatine",
        claimId: "creatine-strength",
        ingestionJobId: "job-pubmed",
        metadata: {
          journal: "Example Journal",
          nested: {
            keepMe: true
          },
          values: ["a", null]
        }
      }),
      update: expect.any(Object)
    });
    expect(prismaMocks.transaction).toHaveBeenCalledWith([{ id: candidate.dedupeKey }]);
  });

  it("does not overwrite review disposition fields when rediscovering candidates", async () => {
    await upsertSourceCandidateDrafts([
      sourceCandidate({
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123|creatine|creatine-strength",
        url: "https://clinicaltrials.gov/study/NCT123",
        sourceType: "Interventional",
        abstractAvailable: undefined
      })
    ]);

    const update = prismaMocks.sourceCandidateUpsert.mock.calls[0]?.[0].update;

    expect(update).toMatchObject({
      source: "CLINICALTRIALS_GOV",
      externalId: "NCT123",
      triageScore: 80
    });
    expect(update).not.toHaveProperty("decision");
    expect(update).not.toHaveProperty("reviewStatus");
    expect(update).not.toHaveProperty("acceptedReferenceId");
    expect(update).not.toHaveProperty("reviewedAt");
    expect(update).not.toHaveProperty("reviewNote");
  });
});

describe("listSourceCandidateReviewQueue", () => {
  it("lists pending candidates in triage order with domain labels", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        metadata: {
          journal: "Example Journal"
        }
      })
    ]);

    await expect(listSourceCandidateReviewQueue()).resolves.toEqual([
      expect.objectContaining({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        source: "PubMed",
        externalId: "28615996",
        decision: "Pending review",
        reviewStatus: "Unreviewed AI draft",
        triageScore: 80,
        metadata: {
          journal: "Example Journal"
        }
      })
    ]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "PENDING_REVIEW"
      },
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 25
    });
  });

  it("bounds queue limits and can filter by source and decision", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await listSourceCandidateReviewQueue({
      decision: "Rejected",
      limit: 250,
      source: "ClinicalTrials.gov"
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "REJECTED",
        source: "CLINICALTRIALS_GOV"
      },
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 100
    });

    await listSourceCandidateReviewQueue({
      limit: 0
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenLastCalledWith({
      where: {
        decision: "PENDING_REVIEW"
      },
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 1
    });
  });
});

describe("summarizeSourceCandidateBacklog", () => {
  it("summarizes source-candidate backlog groups with domain labels", async () => {
    prismaMocks.sourceCandidateGroupBy.mockResolvedValue([
      {
        source: "PUBMED",
        region: "AU",
        decision: "PENDING_REVIEW",
        reviewStatus: "UNREVIEWED_AI_DRAFT",
        _count: {
          _all: 3
        }
      },
      {
        source: "CLINICALTRIALS_GOV",
        region: "AU",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        _count: {
          _all: 1
        }
      }
    ]);

    await expect(summarizeSourceCandidateBacklog()).resolves.toEqual({
      total: 4,
      groups: [
        {
          source: "PubMed",
          region: "AU",
          decision: "Pending review",
          reviewStatus: "Unreviewed AI draft",
          count: 3
        },
        {
          source: "ClinicalTrials.gov",
          region: "AU",
          decision: "Accepted",
          reviewStatus: "Human reviewed",
          count: 1
        }
      ]
    });

    expect(prismaMocks.sourceCandidateGroupBy).toHaveBeenCalledWith({
      by: ["source", "region", "decision", "reviewStatus"],
      _count: {
        _all: true
      },
      orderBy: [
        { source: "asc" },
        { region: "asc" },
        { decision: "asc" },
        { reviewStatus: "asc" }
      ]
    });
  });

  it("returns an empty total when there are no source candidates", async () => {
    prismaMocks.sourceCandidateGroupBy.mockResolvedValue([]);

    await expect(summarizeSourceCandidateBacklog()).resolves.toEqual({
      total: 0,
      groups: []
    });
  });
});

describe("recordSourceCandidateDecision", () => {
  it("records accepted candidates only when linked to a curated reference", async () => {
    const reviewedAt = new Date("2026-06-02T01:00:00.000Z");
    prismaMocks.sourceCandidateUpdate.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt,
        reviewNote: "Promoted after full-text review."
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: " ref-creatine-position-stand ",
        reviewNote: "Promoted after full-text review.",
        reviewedAt
      })
    ).resolves.toEqual(
      expect.objectContaining({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt: "2026-06-02T01:00:00.000Z",
        reviewNote: "Promoted after full-text review."
      })
    );

    expect(prismaMocks.sourceCandidateUpdate).toHaveBeenCalledWith({
      where: {
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "PENDING_REVIEW"
      },
      data: {
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        reviewedAt,
        reviewNote: "Promoted after full-text review.",
        acceptedReferenceId: "ref-creatine-position-stand"
      }
    });
  });

  it("records rejected candidates and clears curated reference links", async () => {
    const reviewedAt = new Date("2026-06-02T02:00:00.000Z");
    prismaMocks.sourceCandidateUpdate.mockResolvedValue(
      dbSourceCandidate({
        decision: "REJECTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: null,
        reviewedAt,
        reviewNote: "Not relevant to the AU consumer claim."
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Rejected",
        reviewNote: "Not relevant to the AU consumer claim.",
        reviewedAt
      })
    ).resolves.toEqual(
      expect.objectContaining({
        decision: "Rejected",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: undefined,
        reviewedAt: "2026-06-02T02:00:00.000Z",
        reviewNote: "Not relevant to the AU consumer claim."
      })
    );

    expect(prismaMocks.sourceCandidateUpdate).toHaveBeenCalledWith({
      where: {
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "PENDING_REVIEW"
      },
      data: {
        decision: "REJECTED",
        reviewStatus: "HUMAN_REVIEWED",
        reviewedAt,
        reviewNote: "Not relevant to the AU consumer claim.",
        acceptedReferenceId: null
      }
    });
  });

  it("rejects accepted decisions without a curated reference link", async () => {
    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: " "
      })
    ).rejects.toThrow("Accepted source candidates require an acceptedReferenceId.");

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("does not overwrite source candidates that are no longer pending review", async () => {
    prismaMocks.sourceCandidateUpdate.mockRejectedValue({
      code: "P2025"
    });

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Rejected",
        reviewNote: "Duplicate."
      })
    ).rejects.toThrow("Pending source candidate not found for review.");

    expect(prismaMocks.sourceCandidateUpdate).toHaveBeenCalledWith({
      where: {
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "PENDING_REVIEW"
      },
      data: {
        decision: "REJECTED",
        reviewStatus: "HUMAN_REVIEWED",
        reviewedAt: expect.any(Date),
        reviewNote: "Duplicate.",
        acceptedReferenceId: null
      }
    });
  });
});

function sourceCandidate(overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return {
    dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
    source: "PubMed",
    externalId: "28615996",
    query: "creatine",
    region: "AU",
    title: "Creatine position stand",
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    publishedYear: 2017,
    sourceType: "Review",
    abstractAvailable: true,
    triageScore: 80,
    triageReasons: ["Title matches query"],
    decision: "Pending review",
    reviewStatus: "Unreviewed AI draft",
    interventionId: "creatine",
    claimId: "creatine-strength",
    ingestionJobId: "job-pubmed",
    metadata: {},
    ...overrides
  };
}

function dbSourceCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
    source: "PUBMED",
    externalId: "28615996",
    query: "creatine",
    region: "AU",
    title: "Creatine position stand",
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    publishedYear: 2017,
    sourceType: "Review",
    abstractAvailable: true,
    triageScore: 80,
    triageReasons: ["Title matches query"],
    metadata: {},
    decision: "PENDING_REVIEW",
    reviewStatus: "UNREVIEWED_AI_DRAFT",
    interventionId: "creatine",
    claimId: "creatine-strength",
    ingestionJobId: "job-pubmed",
    acceptedReferenceId: null,
    reviewedAt: null,
    reviewNote: null,
    discoveredAt: new Date("2026-06-02T00:00:00.000Z"),
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides
  };
}
