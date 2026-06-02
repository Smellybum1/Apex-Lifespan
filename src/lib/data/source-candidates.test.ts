import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  referenceFindMany: vi.fn(),
  referenceFindUnique: vi.fn(),
  sourceCandidateFindMany: vi.fn(),
  sourceCandidateFindUnique: vi.fn(),
  sourceCandidateGroupBy: vi.fn(),
  sourceCandidateUpdate: vi.fn(),
  sourceCandidateUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    reference: {
      findMany: prismaMocks.referenceFindMany,
      findUnique: prismaMocks.referenceFindUnique
    },
    sourceCandidate: {
      findMany: prismaMocks.sourceCandidateFindMany,
      findUnique: prismaMocks.sourceCandidateFindUnique,
      groupBy: prismaMocks.sourceCandidateGroupBy,
      update: prismaMocks.sourceCandidateUpdate,
      upsert: prismaMocks.sourceCandidateUpsert
    },
    $transaction: prismaMocks.transaction
  }
}));

import {
  getSourceCandidateByDedupeKey,
  listSourceCandidateAcceptedReferenceMatches,
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
  prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());
  prismaMocks.referenceFindMany.mockResolvedValue([dbReference()]);
  prismaMocks.referenceFindUnique.mockResolvedValue(dbReference());
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

  it("bounds queue limits and can filter by source, decision, and review scope", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await listSourceCandidateReviewQueue({
      claimId: "creatine-strength",
      decision: "Rejected",
      ingestionJobId: "job-pubmed",
      interventionId: "creatine",
      limit: 250,
      source: "ClinicalTrials.gov"
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: "creatine-strength",
        decision: "REJECTED",
        ingestionJobId: "job-pubmed",
        interventionId: "creatine",
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

describe("getSourceCandidateByDedupeKey", () => {
  it("returns one source candidate by dedupe key", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        metadata: {
          journal: "Example Journal"
        }
      })
    );

    await expect(
      getSourceCandidateByDedupeKey(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual(
      expect.objectContaining({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        source: "PubMed",
        externalId: "28615996",
        metadata: {
          journal: "Example Journal"
        }
      })
    );

    expect(prismaMocks.sourceCandidateFindUnique).toHaveBeenCalledWith({
      where: {
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength"
      }
    });
  });

  it("returns null when the source candidate is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(null);

    await expect(getSourceCandidateByDedupeKey("missing-candidate")).resolves.toBeNull();
  });
});

describe("listSourceCandidateAcceptedReferenceMatches", () => {
  it("lists matching PubMed references using exact identifier and URL rules", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        externalId: "1234",
        url: "https://pubmed.ncbi.nlm.nih.gov/1234/?term=creatine"
      })
    );
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({
        id: "wrong-pubmed-reference",
        identifier: "PMID: 12345",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345/"
      }),
      dbReference({
        id: "ref-by-pmid",
        identifier: "PMID: 1234",
        url: "https://publisher.example/creatine-position-stand"
      }),
      dbReference({
        id: "ref-by-url",
        identifier: "PMID: 7777",
        url: "https://pubmed.ncbi.nlm.nih.gov/1234/#abstract"
      })
    ]);

    await expect(
      listSourceCandidateAcceptedReferenceMatches("pubmed|au|creatine|1234")
    ).resolves.toEqual({
      candidate: expect.objectContaining({
        externalId: "1234",
        source: "PubMed"
      }),
      references: [
        expect.objectContaining({
          id: "ref-by-pmid",
          source: "PubMed",
          identifier: "PMID: 1234"
        }),
        expect.objectContaining({
          id: "ref-by-url",
          source: "PubMed",
          identifier: "PMID: 7777"
        })
      ]
    });

    expect(prismaMocks.referenceFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        source: "PUBMED",
        OR: expect.arrayContaining([
          {
            identifier: {
              contains: "1234"
            }
          },
          {
            url: {
              contains: "1234"
            }
          }
        ])
      }),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 50
    });
  });

  it("lists exact ClinicalTrials.gov NCT matches and excludes generic references", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "CLINICALTRIALS_GOV",
        externalId: "nct123",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/nct123?term=creatine"
      })
    );
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({
        id: "clinicaltrials-api",
        source: "CLINICALTRIALS_GOV",
        identifier: undefined,
        url: "https://clinicaltrials.gov/data-about-studies/learn-about-api"
      }),
      dbReference({
        id: "trial-nct1234",
        source: "CLINICALTRIALS_GOV",
        identifier: "NCT1234",
        url: "https://clinicaltrials.gov/study/NCT1234"
      }),
      dbReference({
        id: "trial-nct123",
        source: "CLINICALTRIALS_GOV",
        identifier: undefined,
        url: "https://clinicaltrials.gov/study/NCT123"
      })
    ]);

    await expect(
      listSourceCandidateAcceptedReferenceMatches(
        "clinicaltrials.gov|au|creatine|nct123"
      )
    ).resolves.toEqual({
      candidate: expect.objectContaining({
        externalId: "nct123",
        source: "ClinicalTrials.gov"
      }),
      references: [
        expect.objectContaining({
          id: "trial-nct123",
          source: "ClinicalTrials.gov"
        })
      ]
    });

    expect(prismaMocks.referenceFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        source: "CLINICALTRIALS_GOV",
        OR: expect.arrayContaining([
          {
            identifier: {
              contains: "NCT123",
              mode: "insensitive"
            }
          },
          {
            url: {
              contains: "NCT123",
              mode: "insensitive"
            }
          }
        ])
      }),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 50
    });
  });

  it("returns a candidate with an empty reference list when no curated references match", async () => {
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({
        id: "wrong-pubmed-reference",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      })
    ]);

    await expect(
      listSourceCandidateAcceptedReferenceMatches(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual({
      candidate: expect.objectContaining({
        externalId: "28615996"
      }),
      references: []
    });
  });

  it("returns null without reading references when the candidate is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(null);

    await expect(
      listSourceCandidateAcceptedReferenceMatches("missing-candidate")
    ).resolves.toBeNull();

    expect(prismaMocks.referenceFindMany).not.toHaveBeenCalled();
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
    expect(prismaMocks.referenceFindUnique).toHaveBeenCalledWith({
      where: {
        id: "ref-creatine-position-stand"
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
    expect(prismaMocks.referenceFindUnique).not.toHaveBeenCalled();
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
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Rejected",
        reviewNote: "Duplicate."
      })
    ).rejects.toThrow("Pending source candidate not found for review.");

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("rejects accepted candidates when the curated reference is missing", async () => {
    prismaMocks.referenceFindUnique.mockResolvedValue(null);

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: "missing-reference"
      })
    ).rejects.toThrow("Accepted source candidate reference was not found.");

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("rejects accepted candidates when the curated reference source does not match", async () => {
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        source: "NIH_ODS",
        identifier: undefined,
        url: "https://ods.od.nih.gov/factsheets/Creatine-HealthProfessional/"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: "ods-creatine"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("rejects accepted candidates when the curated reference external id does not match", async () => {
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: "wrong-pubmed-reference"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("rejects accepted candidates when a PubMed id is only a substring match", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        externalId: "1234",
        url: "https://pubmed.ncbi.nlm.nih.gov/1234/"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        identifier: "PMID: 12345",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345/"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|1234",
        decision: "Accepted",
        acceptedReferenceId: "substring-pubmed-reference"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("accepts PubMed candidates when the curated reference identifier matches exactly", async () => {
    const reviewedAt = new Date("2026-06-02T03:30:00.000Z");
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        identifier: "PMID: 28615996",
        url: "https://example.org/publisher/creatine-position-stand"
      })
    );
    prismaMocks.sourceCandidateUpdate.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt
      })
    ).resolves.toEqual(
      expect.objectContaining({
        source: "PubMed",
        externalId: "28615996",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
  });

  it("accepts ClinicalTrials.gov candidates when the curated reference URL matches the NCT id", async () => {
    const reviewedAt = new Date("2026-06-02T03:00:00.000Z");
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "CLINICALTRIALS_GOV",
        externalId: "nct123",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/nct123"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "trial-nct123",
        source: "CLINICALTRIALS_GOV",
        identifier: undefined,
        url: "https://clinicaltrials.gov/study/NCT123?term=creatine"
      })
    );
    prismaMocks.sourceCandidateUpdate.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "CLINICALTRIALS_GOV",
        externalId: "NCT123",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/NCT123",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "trial-nct123",
        reviewedAt
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        decision: "Accepted",
        acceptedReferenceId: "trial-nct123",
        reviewedAt
      })
    ).resolves.toEqual(
      expect.objectContaining({
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        acceptedReferenceId: "trial-nct123"
      })
    );
  });

  it("rejects ClinicalTrials.gov candidates when an NCT id is only a substring match", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "CLINICALTRIALS_GOV",
        externalId: "NCT123",
        url: "https://clinicaltrials.gov/study/NCT123"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "trial-nct1234",
        source: "CLINICALTRIALS_GOV",
        identifier: "NCT1234",
        url: "https://clinicaltrials.gov/study/NCT1234"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        decision: "Accepted",
        acceptedReferenceId: "trial-nct1234"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
  });

  it("rejects generic ClinicalTrials.gov references that do not identify the candidate NCT record", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "CLINICALTRIALS_GOV",
        externalId: "NCT123",
        url: "https://clinicaltrials.gov/study/NCT123"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "clinicaltrials-api",
        source: "CLINICALTRIALS_GOV",
        identifier: undefined,
        url: "https://clinicaltrials.gov/data-about-studies/learn-about-api"
      })
    );

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        decision: "Accepted",
        acceptedReferenceId: "clinicaltrials-api"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
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

function dbReference(overrides: Record<string, unknown> = {}) {
  return {
    id: "ref-creatine-position-stand",
    title: "Creatine position stand",
    source: "PUBMED",
    identifier: "PMID: 28615996",
    year: 2017,
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides
  };
}
