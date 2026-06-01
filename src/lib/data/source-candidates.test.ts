import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  sourceCandidateUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sourceCandidate: {
      upsert: prismaMocks.sourceCandidateUpsert
    },
    $transaction: prismaMocks.transaction
  }
}));

import { upsertSourceCandidateDrafts } from "@/lib/data/source-candidates";
import type { SourceCandidate } from "@/lib/types";

describe("upsertSourceCandidateDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.sourceCandidateUpsert.mockImplementation((args) => ({
      id: args.where.dedupeKey
    }));
    prismaMocks.transaction.mockImplementation(async (operations) => operations);
  });

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
