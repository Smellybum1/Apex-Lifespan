import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  claimFindUnique: vi.fn(),
  claimReferenceFindMany: vi.fn(),
  claimReferenceFindUnique: vi.fn(),
  claimReferenceUpsert: vi.fn(),
  referenceFindMany: vi.fn(),
  referenceFindUnique: vi.fn(),
  studyCreate: vi.fn(),
  studyFindMany: vi.fn(),
  studyUpdate: vi.fn(),
  sourceCandidateFindMany: vi.fn(),
  sourceCandidateFindUnique: vi.fn(),
  sourceCandidateGroupBy: vi.fn(),
  sourceCandidateUpdate: vi.fn(),
  sourceCandidateUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    claim: {
      findUnique: prismaMocks.claimFindUnique
    },
    claimReference: {
      findMany: prismaMocks.claimReferenceFindMany,
      findUnique: prismaMocks.claimReferenceFindUnique,
      upsert: prismaMocks.claimReferenceUpsert
    },
    reference: {
      findMany: prismaMocks.referenceFindMany,
      findUnique: prismaMocks.referenceFindUnique
    },
    study: {
      create: prismaMocks.studyCreate,
      findMany: prismaMocks.studyFindMany,
      update: prismaMocks.studyUpdate
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
  extractAcceptedSourceCandidateStudy,
  getSourceCandidateCurationDraft,
  getSourceCandidateCurationStatus,
  getSourceCandidateByDedupeKey,
  linkAcceptedSourceCandidateClaim,
  listSourceCandidateAcceptedReferenceMatches,
  listSourceCandidateCurationHandoff,
  listSourceCandidateIdentityGroups,
  listSourceCandidateReviewOverview,
  listSourceCandidateReviewQueue,
  listSourceCandidateSiblings,
  summarizeSourceCandidateCurationHandoff,
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
  prismaMocks.claimFindUnique.mockResolvedValue(dbClaim());
  prismaMocks.claimReferenceFindMany.mockResolvedValue([]);
  prismaMocks.claimReferenceFindUnique.mockResolvedValue(null);
  prismaMocks.claimReferenceUpsert.mockImplementation(async (args) =>
    dbClaimReference(args.create)
  );
  prismaMocks.referenceFindMany.mockResolvedValue([dbReference()]);
  prismaMocks.referenceFindUnique.mockResolvedValue(dbReference());
  prismaMocks.studyCreate.mockImplementation(async (args) => dbStudy(args.data));
  prismaMocks.studyFindMany.mockResolvedValue([]);
  prismaMocks.studyUpdate.mockImplementation(async (args) =>
    dbStudy({
      id: args.where.id,
      ...args.data
    })
  );
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
      externalId: "NCT123",
      ingestionJobId: "job-pubmed",
      interventionId: "creatine",
      limit: 250,
      region: "NZ",
      source: "ClinicalTrials.gov"
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: "creatine-strength",
        decision: "REJECTED",
        externalId: "NCT123",
        ingestionJobId: "job-pubmed",
        interventionId: "creatine",
        region: "NZ",
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

  it("filters review candidates with missing claim or intervention ids", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await listSourceCandidateReviewQueue({
      claimIdMissing: true,
      interventionIdMissing: true,
      region: "AU",
      source: "PubMed"
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: null,
        decision: "PENDING_REVIEW",
        interventionId: null,
        region: "AU",
        source: "PUBMED"
      },
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 25
    });
  });
});

describe("listSourceCandidateReviewOverview", () => {
  it("groups pending candidates by claim, intervention, source, and region", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events",
        externalId: "32634581",
        source: "PUBMED",
        title: "Omega-3 cardiovascular meta-analysis",
        triageScore: 95,
        interventionId: "omega-3",
        claimId: "omega-3-cv-events"
      }),
      dbSourceCandidate({
        dedupeKey:
          "clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events",
        externalId: "NCT01492361",
        source: "CLINICALTRIALS_GOV",
        title: "REDUCE-IT",
        triageScore: 100,
        interventionId: "omega-3",
        claimId: "omega-3-cv-events"
      }),
      dbSourceCandidate({
        dedupeKey:
          "clinicaltrials.gov|au|omega-cv|nct01169259|omega-3|omega-3-cv-events",
        externalId: "NCT01169259",
        source: "CLINICALTRIALS_GOV",
        title: "VITAL",
        triageScore: 85,
        interventionId: "omega-3",
        claimId: "omega-3-cv-events"
      })
    ]);

    await expect(
      listSourceCandidateReviewOverview({
        claimId: "omega-3-cv-events",
        interventionId: "omega-3",
        limit: 10,
        region: "AU"
      })
    ).resolves.toEqual({
      candidateCount: 3,
      totalGroups: 2,
      groups: [
        {
          claimId: "omega-3-cv-events",
          count: 2,
          interventionId: "omega-3",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: expect.objectContaining({
            dedupeKey:
              "clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events",
            externalId: "NCT01492361",
            triageScore: 100
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 100
        },
        {
          claimId: "omega-3-cv-events",
          count: 1,
          interventionId: "omega-3",
          region: "AU",
          source: "PubMed",
          topCandidate: expect.objectContaining({
            dedupeKey: "pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events",
            externalId: "32634581",
            triageScore: 95
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 95
        }
      ]
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: "omega-3-cv-events",
        decision: "PENDING_REVIEW",
        interventionId: "omega-3",
        region: "AU"
      },
      orderBy: [{ triageScore: "desc" }, { updatedAt: "desc" }],
      take: 1000
    });
  });

  it("counts duplicate identities for each overview top candidate", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-meta|42141930||",
        externalId: "42141930",
        query: "creatine meta",
        claimId: null,
        interventionId: null,
        ingestionJobId: "job-unscoped",
        triageScore: 80
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
        externalId: "42141930",
        query: "creatine strength",
        claimId: "creatine-strength",
        interventionId: "creatine",
        ingestionJobId: "job-claim",
        triageScore: 80
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|30762623|creatine|creatine-strength",
        externalId: "30762623",
        query: "creatine strength",
        claimId: "creatine-strength",
        interventionId: "creatine",
        ingestionJobId: "job-claim",
        triageScore: 70
      })
    ]);

    await expect(listSourceCandidateReviewOverview()).resolves.toMatchObject({
      groups: [
        expect.objectContaining({
          claimId: "creatine-strength",
          topCandidate: expect.objectContaining({
            dedupeKey: "pubmed|au|creatine-strength|42141930|creatine|creatine-strength"
          }),
          topIdentityCandidateCount: 2
        }),
        expect.objectContaining({
          claimId: undefined,
          topCandidate: expect.objectContaining({
            dedupeKey: "pubmed|au|creatine-meta|42141930||"
          }),
          topIdentityCandidateCount: 2
        })
      ]
    });
  });

  it("bounds overview group limits", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|claim-a|1|a|claim-a",
        claimId: "claim-a",
        interventionId: "a"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|claim-b|2|b|claim-b",
        claimId: "claim-b",
        interventionId: "b"
      })
    ]);

    await expect(listSourceCandidateReviewOverview({ limit: 1 })).resolves.toMatchObject({
      groups: [expect.objectContaining({ claimId: "claim-a" })],
      totalGroups: 2
    });
    await expect(listSourceCandidateReviewOverview({ limit: 200 })).resolves.toMatchObject({
      groups: [
        expect.objectContaining({ claimId: "claim-a" }),
        expect.objectContaining({ claimId: "claim-b" })
      ],
      totalGroups: 2
    });
  });

  it("keeps database queue ordering for tied top triage scores", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|omega-cv|z-newer|omega-3|omega-3-cv-events",
        externalId: "z-newer",
        triageScore: 100,
        interventionId: "omega-3",
        claimId: "omega-3-cv-events",
        updatedAt: new Date("2026-06-03T00:00:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|omega-cv|a-older|omega-3|omega-3-cv-events",
        externalId: "a-older",
        triageScore: 100,
        interventionId: "omega-3",
        claimId: "omega-3-cv-events",
        updatedAt: new Date("2026-06-02T00:00:00.000Z")
      })
    ]);

    await expect(listSourceCandidateReviewOverview()).resolves.toMatchObject({
      groups: [
        {
          count: 2,
          topCandidate: expect.objectContaining({
            dedupeKey: "pubmed|au|omega-cv|z-newer|omega-3|omega-3-cv-events"
          }),
          topTriageScore: 100
        }
      ]
    });
  });
});

describe("listSourceCandidateIdentityGroups", () => {
  it("lists duplicate source/external-id groups for review candidates", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-meta|42141930||",
        externalId: "42141930",
        query: "creatine meta",
        claimId: null,
        interventionId: null,
        ingestionJobId: "job-unscoped"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
        externalId: "42141930",
        query: "creatine strength",
        ingestionJobId: "job-claim"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|30762623|creatine|creatine-strength",
        externalId: "30762623",
        query: "creatine strength",
        ingestionJobId: "job-claim"
      })
    ]);

    await expect(
      listSourceCandidateIdentityGroups({
        externalId: "42141930",
        limit: 2,
        source: "PubMed"
      })
    ).resolves.toEqual([
      {
        candidates: [
          expect.objectContaining({
            dedupeKey: "pubmed|au|creatine-meta|42141930||",
            externalId: "42141930",
            claimId: undefined,
            interventionId: undefined
          }),
          expect.objectContaining({
            dedupeKey:
              "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
            externalId: "42141930",
            claimId: "creatine-strength",
            interventionId: "creatine"
          })
        ],
        externalId: "42141930",
        source: "PubMed"
      }
    ]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "PENDING_REVIEW",
        externalId: "42141930",
        source: "PUBMED"
      },
      orderBy: [{ source: "asc" }, { externalId: "asc" }, { triageScore: "desc" }],
      take: 500
    });
  });

  it("bounds duplicate group limits", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|1a",
        externalId: "1"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|1b",
        externalId: "1"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|2a",
        externalId: "2"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|2b",
        externalId: "2"
      })
    ]);

    await expect(listSourceCandidateIdentityGroups({ limit: 1 })).resolves.toHaveLength(1);
    await expect(listSourceCandidateIdentityGroups({ limit: 250 })).resolves.toHaveLength(
      2
    );
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

describe("listSourceCandidateSiblings", () => {
  it("lists same-source external-id and query-context siblings with match reasons", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        externalId: "28615996",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    );
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-aging|28615996|creatine|creatine-aging",
        externalId: "28615996",
        query: "creatine aging",
        claimId: "creatine-aging"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine-strength|999999|creatine|creatine-strength",
        externalId: "999999",
        query: "creatine strength"
      })
    ]);

    await expect(
      listSourceCandidateSiblings(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual({
      target: expect.objectContaining({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        externalId: "28615996",
        query: "creatine strength",
        source: "PubMed"
      }),
      siblings: [
        {
          candidate: expect.objectContaining({
            dedupeKey:
              "pubmed|au|creatine-aging|28615996|creatine|creatine-aging",
            externalId: "28615996",
            query: "creatine aging"
          }),
          matchReasons: ["Same source/external id", "Same intervention context"]
        },
        {
          candidate: expect.objectContaining({
            dedupeKey:
              "pubmed|au|creatine-strength|999999|creatine|creatine-strength",
            externalId: "999999",
            query: "creatine strength"
          }),
          matchReasons: [
            "Same query/region",
            "Same intervention context",
            "Same claim context"
          ]
        }
      ]
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        dedupeKey: {
          not: "pubmed|au|creatine|28615996|creatine|creatine-strength"
        },
        OR: [
          {
            externalId: "28615996"
          },
          {
            claimId: "creatine-strength",
            interventionId: "creatine",
            query: "creatine strength",
            region: "AU"
          }
        ]
      },
      orderBy: [{ externalId: "asc" }, { triageScore: "desc" }, { updatedAt: "desc" }],
      take: 25
    });
  });

  it("bounds sibling limits", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await listSourceCandidateSiblings(
      "pubmed|au|creatine|28615996|creatine|creatine-strength",
      { limit: 0 }
    );
    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 1
      })
    );

    await listSourceCandidateSiblings(
      "pubmed|au|creatine|28615996|creatine|creatine-strength",
      { limit: 250 }
    );
    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 50
      })
    );
  });

  it("returns null without reading sibling rows when the target candidate is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(null);

    await expect(listSourceCandidateSiblings("missing-candidate")).resolves.toBeNull();

    expect(prismaMocks.sourceCandidateFindMany).not.toHaveBeenCalled();
  });
});

describe("getSourceCandidateCurationStatus", () => {
  it("reports accepted candidates that are linked and extracted for public source packets", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({
        note: "Primary source for the claim."
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      getSourceCandidateCurationStatus(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual({
      acceptedReference: expect.objectContaining({
        id: "ref-creatine-position-stand",
        source: "PubMed"
      }),
      acceptedReferenceId: "ref-creatine-position-stand",
      candidate: expect.objectContaining({
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength",
        decision: "Accepted"
      }),
      candidateClaimLinked: true,
      claimLinks: [
        {
          claimId: "creatine-strength",
          note: "Primary source for the claim.",
          relevance: 5
        }
      ],
      nextAction: "Review for public source packet inclusion.",
      publicSourcePacketReady: true,
      status: "Public source packet ready",
      studies: [
        {
          id: "study-creatine-issn",
          referenceId: "ref-creatine-position-stand",
          title: "Creatine position stand extraction",
          year: 2017
        }
      ]
    });

    expect(prismaMocks.referenceFindUnique).toHaveBeenCalledWith({
      where: {
        id: "ref-creatine-position-stand"
      }
    });
    expect(prismaMocks.claimReferenceFindMany).toHaveBeenCalledWith({
      where: {
        referenceId: "ref-creatine-position-stand"
      },
      orderBy: [{ claimId: "asc" }]
    });
    expect(prismaMocks.studyFindMany).toHaveBeenCalledWith({
      where: {
        referenceId: "ref-creatine-position-stand"
      },
      orderBy: [{ year: "desc" }, { title: "asc" }]
    });
  });

  it("reports accepted candidates with claim links but pending extraction", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([dbClaimReference()]);
    prismaMocks.studyFindMany.mockResolvedValue([]);

    await expect(
      getSourceCandidateCurationStatus(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toMatchObject({
      acceptedReferenceId: "ref-creatine-position-stand",
      candidateClaimLinked: true,
      nextAction: "Add structured study extraction for the accepted reference.",
      publicSourcePacketReady: false,
      status: "Extraction pending",
      studies: []
    });
  });

  it("does not mark accepted candidates without claim context ready", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: null
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([dbClaimReference()]);
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      getSourceCandidateCurationStatus("pubmed|au|creatine|28615996")
    ).resolves.toMatchObject({
      acceptedReferenceId: "ref-creatine-position-stand",
      candidateClaimLinked: undefined,
      claimLinks: [
        {
          claimId: "creatine-strength",
          relevance: 5
        }
      ],
      nextAction:
        "Review or queue this candidate with a claim id before public packet review.",
      publicSourcePacketReady: false,
      status: "Candidate claim missing",
      studies: [
        expect.objectContaining({
          id: "study-creatine-issn"
        })
      ]
    });
  });

  it("reports accepted candidates that are not claim-linked yet", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([]);
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      getSourceCandidateCurationStatus(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toMatchObject({
      acceptedReferenceId: "ref-creatine-position-stand",
      candidateClaimLinked: false,
      claimLinks: [],
      nextAction:
        "Link the accepted reference to the candidate claim before public packet review.",
      publicSourcePacketReady: false,
      status: "Claim link missing"
    });
  });

  it("does not mark candidates ready when the reference is linked only to another claim", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength"
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({
        claimId: "creatine-muscle-mass"
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      getSourceCandidateCurationStatus(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toMatchObject({
      candidateClaimLinked: false,
      claimLinks: [
        {
          claimId: "creatine-muscle-mass",
          relevance: 5
        }
      ],
      nextAction:
        "Link the accepted reference to the candidate claim before public packet review.",
      publicSourcePacketReady: false,
      status: "Claim link missing"
    });
  });

  it("reports accepted candidates whose accepted reference is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "missing-reference"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(null);

    await expect(
      getSourceCandidateCurationStatus("pubmed|au|creatine|28615996")
    ).resolves.toMatchObject({
      acceptedReferenceId: "missing-reference",
      claimLinks: [],
      nextAction:
        "Attach or restore the matching curated reference before public packet review.",
      publicSourcePacketReady: false,
      status: "Accepted reference missing",
      studies: []
    });

    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("reports accepted candidates whose accepted reference no longer matches", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "wrong-pubmed-reference"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "wrong-pubmed-reference",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      })
    );

    await expect(
      getSourceCandidateCurationStatus("pubmed|au|creatine|28615996")
    ).resolves.toMatchObject({
      acceptedReference: expect.objectContaining({
        id: "wrong-pubmed-reference"
      }),
      acceptedReferenceId: "wrong-pubmed-reference",
      claimLinks: [],
      nextAction:
        "Replace the accepted reference with one matching the candidate source and external id.",
      publicSourcePacketReady: false,
      status: "Accepted reference mismatch",
      studies: []
    });

    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("reports accepted candidates without an accepted reference id as missing-reference curation gaps", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: null
      })
    );

    await expect(
      getSourceCandidateCurationStatus("pubmed|au|creatine|28615996")
    ).resolves.toMatchObject({
      acceptedReferenceId: undefined,
      claimLinks: [],
      nextAction:
        "Attach or restore the matching curated reference before public packet review.",
      publicSourcePacketReady: false,
      status: "Accepted reference missing",
      studies: []
    });

    expect(prismaMocks.referenceFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("reports pending or rejected candidates without reading curation tables", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());

    await expect(
      getSourceCandidateCurationStatus("pubmed|au|creatine|28615996")
    ).resolves.toMatchObject({
      acceptedReferenceId: undefined,
      claimLinks: [],
      nextAction: "Accept with a matching curated reference before curation handoff.",
      publicSourcePacketReady: false,
      status: "Not accepted",
      studies: []
    });

    expect(prismaMocks.referenceFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("returns null when the source candidate is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(null);

    await expect(
      getSourceCandidateCurationStatus("missing-candidate")
    ).resolves.toBeNull();
  });
});

describe("getSourceCandidateCurationDraft", () => {
  it("drafts claim-link and study-extraction fields for accepted candidates", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        sourceType: "Review",
        metadata: {
          authors: ["Kreider RB", "Kalman DS"],
          doi: "10.1186/s12970-017-0173-z",
          journal: "Journal of the International Society of Sports Nutrition",
          publicationDate: "2017 Jun 13",
          publicationTypes: ["Journal Article", "Review"]
        }
      })
    );
    prismaMocks.claimReferenceFindMany.mockResolvedValue([]);
    prismaMocks.studyFindMany.mockResolvedValue([]);

    await expect(
      getSourceCandidateCurationDraft(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual({
      claimLinkDraft: {
        alreadyLinked: false,
        claimId: "creatine-strength",
        note:
          "Accepted PubMed candidate 28615996: Creatine position stand",
        referenceId: "ref-creatine-position-stand",
        relevance: 5
      },
      status: expect.objectContaining({
        acceptedReferenceId: "ref-creatine-position-stand",
        candidateClaimLinked: false,
        publicSourcePacketReady: false,
        status: "Claim link missing"
      }),
      studyExtractionDraft: {
        abstractAvailable: true,
        alreadyExtracted: false,
        doi: "10.1186/s12970-017-0173-z",
        manualFields: [
          "sampleSize",
          "population",
          "interventionName",
          "outcomes",
          "adverseEvents",
          "fundingConflicts",
          "riskOfBias"
        ],
        metadataFields: [
          {
            label: "journal",
            value: "Journal of the International Society of Sports Nutrition"
          },
          {
            label: "publicationDate",
            value: "2017 Jun 13"
          },
          {
            label: "publicationTypes",
            value: "Journal Article, Review"
          },
          {
            label: "authors",
            value: "Kreider RB, Kalman DS"
          },
          {
            label: "doi",
            value: "10.1186/s12970-017-0173-z"
          }
        ],
        nctId: undefined,
        pmid: "28615996",
        referenceId: "ref-creatine-position-stand",
        source: "PubMed",
        sourceTypeSuggestion: "SYSTEMATIC_REVIEW",
        title: "Creatine position stand",
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        year: 2017
      }
    });
  });

  it("reports blockers without draft fields for candidates that are not accepted", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());

    await expect(
      getSourceCandidateCurationDraft(
        "pubmed|au|creatine|28615996|creatine|creatine-strength"
      )
    ).resolves.toEqual({
      claimLinkDraft: undefined,
      status: expect.objectContaining({
        nextAction: "Accept with a matching curated reference before curation handoff.",
        publicSourcePacketReady: false,
        status: "Not accepted"
      }),
      studyExtractionDraft: undefined
    });

    expect(prismaMocks.referenceFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("returns null when the source candidate is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(null);

    await expect(getSourceCandidateCurationDraft("missing-candidate")).resolves.toBeNull();
  });
});

describe("linkAcceptedSourceCandidateClaim", () => {
  it("creates a claim link for accepted candidates with matching references", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(null);
    prismaMocks.claimReferenceUpsert.mockResolvedValue(
      dbClaimReference({
        note: "Primary accepted candidate link.",
        relevance: 4
      })
    );
    prismaMocks.studyFindMany.mockResolvedValue([]);

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        note: " Primary accepted candidate link. ",
        relevance: 4
      })
    ).resolves.toEqual({
      acceptedReference: expect.objectContaining({
        id: "ref-creatine-position-stand",
        source: "PubMed"
      }),
      candidate: expect.objectContaining({
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength",
        decision: "Accepted"
      }),
      claimLink: {
        claimId: "creatine-strength",
        note: "Primary accepted candidate link.",
        relevance: 4
      },
      created: true,
      status: expect.objectContaining({
        candidateClaimLinked: true,
        nextAction: "Add structured study extraction for the accepted reference.",
        publicSourcePacketReady: false,
        status: "Extraction pending"
      })
    });

    expect(prismaMocks.claimFindUnique).toHaveBeenCalledWith({
      where: {
        id: "creatine-strength"
      }
    });
    expect(prismaMocks.claimReferenceFindUnique).toHaveBeenCalledWith({
      where: {
        claimId_referenceId: {
          claimId: "creatine-strength",
          referenceId: "ref-creatine-position-stand"
        }
      }
    });
    expect(prismaMocks.claimReferenceUpsert).toHaveBeenCalledWith({
      where: {
        claimId_referenceId: {
          claimId: "creatine-strength",
          referenceId: "ref-creatine-position-stand"
        }
      },
      create: {
        claimId: "creatine-strength",
        note: "Primary accepted candidate link.",
        referenceId: "ref-creatine-position-stand",
        relevance: 4
      },
      update: {
        note: "Primary accepted candidate link.",
        relevance: 4
      }
    });
  });

  it("updates existing claim links and reports public packet readiness when extracted", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(dbClaimReference());
    prismaMocks.claimReferenceUpsert.mockResolvedValue(dbClaimReference());
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        relevance: 99
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimLink: {
          claimId: "creatine-strength",
          note: undefined,
          relevance: 5
        },
        created: false,
        status: expect.objectContaining({
          publicSourcePacketReady: true,
          status: "Public source packet ready"
        })
      })
    );

    expect(prismaMocks.claimReferenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          relevance: 5
        }),
        update: {
          note:
            "Accepted PubMed candidate 28615996: Creatine position stand",
          relevance: 5
        }
      })
    );
  });

  it("refuses to link candidates that are not accepted", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength"
      })
    ).rejects.toThrow("Accepted source candidate not found for claim linking.");

    expect(prismaMocks.referenceFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceUpsert).not.toHaveBeenCalled();
  });

  it("refuses to link accepted candidates with mismatched references", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "wrong-pubmed-reference"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "wrong-pubmed-reference",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      })
    );

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength"
      })
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.claimReferenceUpsert).not.toHaveBeenCalled();
  });

  it("refuses to link candidates whose claim context is missing or stale", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: null
      })
    );

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996"
      })
    ).rejects.toThrow("Accepted source candidate requires a claimId before claim linking.");

    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimFindUnique.mockResolvedValue(
      dbClaim({
        interventionId: "different-intervention"
      })
    );

    await expect(
      linkAcceptedSourceCandidateClaim({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength"
      })
    ).rejects.toThrow(
      "Accepted source candidate claim must belong to candidate intervention."
    );
  });
});

describe("extractAcceptedSourceCandidateStudy", () => {
  it("creates structured study extraction for accepted claim-linked candidates", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        metadata: {
          doi: "10.1186/s12970-017-0173-z",
          publicationTypes: ["Review"]
        }
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(
      dbClaimReference({
        note: "Primary accepted candidate link."
      })
    );
    prismaMocks.studyFindMany.mockResolvedValue([]);

    await expect(
      extractAcceptedSourceCandidateStudy({
        abstract: "Position stand abstract.",
        adverseEvents: "No consistent serious adverse events reported.",
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        dose: "3-5 g/day maintenance",
        duration: "Varied by included study.",
        fundingConflicts: "Society position stand; author conflicts disclosed.",
        interventionName: "Creatine monohydrate",
        mainResults: "Supports strength and lean-mass outcomes alongside training.",
        outcomes: [" Strength ", "lean mass"],
        population: "Healthy exercising adults",
        relevance: 4,
        riskOfBias: "Narrative synthesis; not a single randomized trial.",
        sampleSize: "Position stand covering multiple human studies"
      })
    ).resolves.toEqual({
      acceptedReference: expect.objectContaining({
        id: "ref-creatine-position-stand",
        source: "PubMed"
      }),
      candidate: expect.objectContaining({
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength",
        decision: "Accepted"
      }),
      created: true,
      status: expect.objectContaining({
        candidateClaimLinked: true,
        nextAction: "Review for public source packet inclusion.",
        publicSourcePacketReady: true,
        status: "Public source packet ready"
      }),
      study: {
        id: "study-creatine-issn",
        referenceId: "ref-creatine-position-stand",
        title: "Creatine position stand",
        year: 2017
      }
    });

    expect(prismaMocks.studyCreate).toHaveBeenCalledWith({
      data: {
        abstract: "Position stand abstract.",
        adverseEvents: "No consistent serious adverse events reported.",
        doi: "10.1186/s12970-017-0173-z",
        dose: "3-5 g/day maintenance",
        duration: "Varied by included study.",
        fundingConflicts: "Society position stand; author conflicts disclosed.",
        interventionName: "Creatine monohydrate",
        mainResults: "Supports strength and lean-mass outcomes alongside training.",
        nctId: undefined,
        outcomes: ["Strength", "lean mass"],
        pmid: "28615996",
        population: "Healthy exercising adults",
        referenceId: "ref-creatine-position-stand",
        relevanceScore: 4,
        riskOfBias: "Narrative synthesis; not a single randomized trial.",
        sampleSize: "Position stand covering multiple human studies",
        source: "PubMed",
        sourceType: "SYSTEMATIC_REVIEW",
        title: "Creatine position stand",
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        year: 2017
      }
    });
    expect(prismaMocks.studyUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing extraction only when explicitly requested", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(dbClaimReference());
    prismaMocks.studyFindMany.mockResolvedValue([
      dbStudy({
        id: "study-existing"
      })
    ]);

    await expect(
      extractAcceptedSourceCandidateStudy({
        adverseEvents: "No serious adverse events reported.",
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        fundingConflicts: "Not independently extracted.",
        interventionName: "Creatine",
        outcomes: ["Strength"],
        population: "Healthy adults",
        relevance: 99,
        riskOfBias: "Review-level evidence; manual extraction needed.",
        sampleSize: "Multiple studies",
        updateExisting: true
      })
    ).resolves.toEqual(
      expect.objectContaining({
        created: false,
        study: {
          id: "study-existing",
          referenceId: "ref-creatine-position-stand",
          title: "Creatine position stand",
          year: 2017
        }
      })
    );

    expect(prismaMocks.studyUpdate).toHaveBeenCalledWith({
      where: {
        id: "study-existing"
      },
      data: expect.objectContaining({
        relevanceScore: 5,
        sourceType: "SYSTEMATIC_REVIEW"
      })
    });
    expect(prismaMocks.studyCreate).not.toHaveBeenCalled();
  });

  it("refuses extraction when the claim link is missing", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(null);

    await expect(
      extractAcceptedSourceCandidateStudy(studyExtractionInput())
    ).rejects.toThrow(
      "Accepted source candidate claim link is required before study extraction."
    );

    expect(prismaMocks.studyCreate).not.toHaveBeenCalled();
    expect(prismaMocks.studyUpdate).not.toHaveBeenCalled();
  });

  it("refuses existing extraction unless updateExisting is requested", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(dbClaimReference());
    prismaMocks.studyFindMany.mockResolvedValue([dbStudy()]);

    await expect(
      extractAcceptedSourceCandidateStudy(studyExtractionInput())
    ).rejects.toThrow("Accepted source candidate reference already has study extraction.");

    expect(prismaMocks.studyCreate).not.toHaveBeenCalled();
    expect(prismaMocks.studyUpdate).not.toHaveBeenCalled();
  });

  it("refuses candidates before acceptance or with mismatched references", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(dbSourceCandidate());

    await expect(
      extractAcceptedSourceCandidateStudy(studyExtractionInput())
    ).rejects.toThrow("Accepted source candidate not found for study extraction.");

    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        acceptedReferenceId: "wrong-pubmed-reference",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED"
      })
    );
    prismaMocks.referenceFindUnique.mockResolvedValue(
      dbReference({
        id: "wrong-pubmed-reference",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      })
    );

    await expect(
      extractAcceptedSourceCandidateStudy(studyExtractionInput())
    ).rejects.toThrow(
      "Accepted source candidate reference must match candidate source and external id."
    );

    expect(prismaMocks.studyCreate).not.toHaveBeenCalled();
    expect(prismaMocks.studyUpdate).not.toHaveBeenCalled();
  });

  it("requires operator-supplied extraction fields and source type when not inferred", async () => {
    prismaMocks.sourceCandidateFindUnique.mockResolvedValue(
      dbSourceCandidate({
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-creatine-position-stand",
        sourceType: "Journal Article"
      })
    );
    prismaMocks.claimReferenceFindUnique.mockResolvedValue(dbClaimReference());
    prismaMocks.studyFindMany.mockResolvedValue([]);

    await expect(
      extractAcceptedSourceCandidateStudy({
        ...studyExtractionInput(),
        outcomes: []
      })
    ).rejects.toThrow("Study extraction requires at least one --study-outcome.");

    await expect(
      extractAcceptedSourceCandidateStudy({
        ...studyExtractionInput(),
        outcomes: ["Strength"]
      })
    ).rejects.toThrow(
      "Study extraction requires --study-source-type because source type cannot be inferred."
    );

    await expect(
      extractAcceptedSourceCandidateStudy({
        ...studyExtractionInput(),
        outcomes: ["Strength"],
        sourceType: "OBSERVATIONAL_COHORT"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        created: true
      })
    );

    expect(prismaMocks.studyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: "OBSERVATIONAL_COHORT"
        })
      })
    );
  });
});

describe("listSourceCandidateCurationHandoff", () => {
  it("lists accepted candidates with public packet readiness statuses", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|ready",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-ready",
        reviewedAt: new Date("2026-06-02T01:00:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|pending-extraction",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-pending-extraction",
        reviewedAt: new Date("2026-06-02T02:00:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|claim-link-missing",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-claim-link-missing",
        reviewedAt: new Date("2026-06-02T03:00:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|reference-mismatch",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-reference-mismatch",
        reviewedAt: new Date("2026-06-02T03:30:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|candidate-claim-missing",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-candidate-claim-missing",
        claimId: null,
        reviewedAt: new Date("2026-06-02T03:45:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|missing-reference",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-missing",
        reviewedAt: new Date("2026-06-02T04:00:00.000Z")
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|missing-reference-id",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: null,
        reviewedAt: new Date("2026-06-02T05:00:00.000Z")
      })
    ]);
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({ id: "ref-ready" }),
      dbReference({ id: "ref-pending-extraction" }),
      dbReference({ id: "ref-claim-link-missing" }),
      dbReference({
        id: "ref-reference-mismatch",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      }),
      dbReference({ id: "ref-candidate-claim-missing" })
    ]);
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({ referenceId: "ref-ready" }),
      dbClaimReference({ referenceId: "ref-pending-extraction" }),
      dbClaimReference({
        claimId: "different-claim",
        referenceId: "ref-claim-link-missing"
      }),
      dbClaimReference({
        referenceId: "ref-reference-mismatch"
      }),
      dbClaimReference({
        referenceId: "ref-candidate-claim-missing"
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([
      dbStudy({ id: "study-ready", referenceId: "ref-ready" }),
      dbStudy({
        id: "study-claim-link-missing",
        referenceId: "ref-claim-link-missing"
      }),
      dbStudy({
        id: "study-reference-mismatch",
        referenceId: "ref-reference-mismatch"
      }),
      dbStudy({
        id: "study-candidate-claim-missing",
        referenceId: "ref-candidate-claim-missing"
      })
    ]);

    await expect(
      listSourceCandidateCurationHandoff({
        claimId: "creatine-strength",
        ingestionJobId: "job-pubmed",
        interventionId: "creatine",
        limit: 100,
        region: "AU",
        source: "PubMed"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        acceptedReferenceId: "ref-ready",
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|ready",
          decision: "Accepted"
        }),
        candidateClaimLinked: true,
        claimLinks: [
          {
            claimId: "creatine-strength",
            note: undefined,
            relevance: 5
          }
        ],
        nextAction: "Review for public source packet inclusion.",
        publicSourcePacketReady: true,
        status: "Public source packet ready",
        studies: [
          expect.objectContaining({
            id: "study-ready",
            referenceId: "ref-ready"
          })
        ]
      }),
      expect.objectContaining({
        acceptedReferenceId: "ref-pending-extraction",
        candidateClaimLinked: true,
        nextAction: "Add structured study extraction for the accepted reference.",
        publicSourcePacketReady: false,
        status: "Extraction pending",
        studies: []
      }),
      expect.objectContaining({
        acceptedReferenceId: "ref-claim-link-missing",
        candidateClaimLinked: false,
        claimLinks: [
          {
            claimId: "different-claim",
            note: undefined,
            relevance: 5
          }
        ],
        nextAction:
          "Link the accepted reference to the candidate claim before public packet review.",
        publicSourcePacketReady: false,
        status: "Claim link missing"
      }),
      expect.objectContaining({
        acceptedReferenceId: "ref-reference-mismatch",
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|reference-mismatch"
        }),
        claimLinks: [],
        nextAction:
          "Replace the accepted reference with one matching the candidate source and external id.",
        publicSourcePacketReady: false,
        status: "Accepted reference mismatch",
        studies: []
      }),
      expect.objectContaining({
        acceptedReferenceId: "ref-candidate-claim-missing",
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|candidate-claim-missing"
        }),
        candidateClaimLinked: undefined,
        claimLinks: [
          {
            claimId: "creatine-strength",
            note: undefined,
            relevance: 5
          }
        ],
        nextAction:
          "Review or queue this candidate with a claim id before public packet review.",
        publicSourcePacketReady: false,
        status: "Candidate claim missing",
        studies: [
          expect.objectContaining({
            id: "study-candidate-claim-missing",
            referenceId: "ref-candidate-claim-missing"
          })
        ]
      }),
      expect.objectContaining({
        acceptedReferenceId: "ref-missing",
        claimLinks: [],
        nextAction:
          "Attach or restore the matching curated reference before public packet review.",
        publicSourcePacketReady: false,
        status: "Accepted reference missing",
        studies: []
      }),
      expect.objectContaining({
        acceptedReferenceId: undefined,
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|missing-reference-id"
        }),
        claimLinks: [],
        nextAction:
          "Attach or restore the matching curated reference before public packet review.",
        publicSourcePacketReady: false,
        status: "Accepted reference missing",
        studies: []
      })
    ]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: "creatine-strength",
        decision: "ACCEPTED",
        ingestionJobId: "job-pubmed",
        interventionId: "creatine",
        region: "AU",
        source: "PUBMED"
      },
      orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }],
      take: 50
    });
    expect(prismaMocks.referenceFindMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [
            "ref-ready",
            "ref-pending-extraction",
            "ref-claim-link-missing",
            "ref-reference-mismatch",
            "ref-candidate-claim-missing",
            "ref-missing"
          ]
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
    });
    expect(prismaMocks.claimReferenceFindMany).toHaveBeenCalledWith({
      where: {
        referenceId: {
          in: [
            "ref-ready",
            "ref-pending-extraction",
            "ref-claim-link-missing",
            "ref-reference-mismatch",
            "ref-candidate-claim-missing",
            "ref-missing"
          ]
        }
      },
      orderBy: [{ referenceId: "asc" }, { claimId: "asc" }]
    });
    expect(prismaMocks.studyFindMany).toHaveBeenCalledWith({
      where: {
        referenceId: {
          in: [
            "ref-ready",
            "ref-pending-extraction",
            "ref-claim-link-missing",
            "ref-reference-mismatch",
            "ref-candidate-claim-missing",
            "ref-missing"
          ]
        }
      },
      orderBy: [{ referenceId: "asc" }, { year: "desc" }, { title: "asc" }]
    });
  });

  it("returns an empty handoff list without reading curation tables", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await expect(listSourceCandidateCurationHandoff()).resolves.toEqual([]);

    expect(prismaMocks.referenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("filters curation handoff rows with missing claim or intervention ids", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await expect(
      listSourceCandidateCurationHandoff({
        claimIdMissing: true,
        interventionIdMissing: true,
        region: "AU",
        source: "PubMed"
      })
    ).resolves.toEqual([]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        claimId: null,
        decision: "ACCEPTED",
        interventionId: null,
        region: "AU",
        source: "PUBMED"
      },
      orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }],
      take: 25
    });
    expect(prismaMocks.referenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
  });

  it("filters curation handoff rows by derived readiness status", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|ready",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-ready"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|claim-link-missing",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-claim-link-missing"
      })
    ]);
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({ id: "ref-ready" }),
      dbReference({ id: "ref-claim-link-missing" })
    ]);
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({ referenceId: "ref-ready" }),
      dbClaimReference({
        claimId: "different-claim",
        referenceId: "ref-claim-link-missing"
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([
      dbStudy({ id: "study-ready", referenceId: "ref-ready" }),
      dbStudy({
        id: "study-claim-link-missing",
        referenceId: "ref-claim-link-missing"
      })
    ]);

    await expect(
      listSourceCandidateCurationHandoff({
        status: "Claim link missing"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|claim-link-missing"
        }),
        publicSourcePacketReady: false,
        status: "Claim link missing"
      })
    ]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "ACCEPTED"
      },
      orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }]
    });
  });

  it("applies curation handoff status filtering before the display limit", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|ready",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-ready"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|claim-link-missing-1",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-claim-link-missing-1"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|claim-link-missing-2",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-claim-link-missing-2"
      })
    ]);
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({ id: "ref-ready" }),
      dbReference({ id: "ref-claim-link-missing-1" }),
      dbReference({ id: "ref-claim-link-missing-2" })
    ]);
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({ referenceId: "ref-ready" }),
      dbClaimReference({
        claimId: "different-claim",
        referenceId: "ref-claim-link-missing-1"
      }),
      dbClaimReference({
        claimId: "different-claim",
        referenceId: "ref-claim-link-missing-2"
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([
      dbStudy({ id: "study-ready", referenceId: "ref-ready" }),
      dbStudy({
        id: "study-claim-link-missing-1",
        referenceId: "ref-claim-link-missing-1"
      }),
      dbStudy({
        id: "study-claim-link-missing-2",
        referenceId: "ref-claim-link-missing-2"
      })
    ]);

    await expect(
      listSourceCandidateCurationHandoff({
        limit: 1,
        status: "Claim link missing"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({
          dedupeKey: "pubmed|au|creatine|claim-link-missing-1"
        }),
        status: "Claim link missing"
      })
    ]);

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "ACCEPTED"
      },
      orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }]
    });
  });
});

describe("summarizeSourceCandidateCurationHandoff", () => {
  it("summarizes accepted candidate curation readiness counts", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|ready",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-ready"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|pending-extraction",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-pending-extraction"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|claim-link-missing",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-claim-link-missing"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|reference-mismatch",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-reference-mismatch"
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|candidate-claim-missing",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-candidate-claim-missing",
        claimId: null
      }),
      dbSourceCandidate({
        dedupeKey: "pubmed|au|creatine|missing-reference",
        decision: "ACCEPTED",
        reviewStatus: "HUMAN_REVIEWED",
        acceptedReferenceId: "ref-missing"
      })
    ]);
    prismaMocks.referenceFindMany.mockResolvedValue([
      dbReference({ id: "ref-ready" }),
      dbReference({ id: "ref-pending-extraction" }),
      dbReference({ id: "ref-claim-link-missing" }),
      dbReference({
        id: "ref-reference-mismatch",
        identifier: "PMID: 12345678",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      }),
      dbReference({ id: "ref-candidate-claim-missing" })
    ]);
    prismaMocks.claimReferenceFindMany.mockResolvedValue([
      dbClaimReference({ referenceId: "ref-ready" }),
      dbClaimReference({ referenceId: "ref-pending-extraction" }),
      dbClaimReference({
        claimId: "different-claim",
        referenceId: "ref-claim-link-missing"
      }),
      dbClaimReference({
        referenceId: "ref-reference-mismatch"
      }),
      dbClaimReference({
        referenceId: "ref-candidate-claim-missing"
      })
    ]);
    prismaMocks.studyFindMany.mockResolvedValue([
      dbStudy({ id: "study-ready", referenceId: "ref-ready" }),
      dbStudy({
        id: "study-claim-link-missing",
        referenceId: "ref-claim-link-missing"
      }),
      dbStudy({
        id: "study-reference-mismatch",
        referenceId: "ref-reference-mismatch"
      }),
      dbStudy({
        id: "study-candidate-claim-missing",
        referenceId: "ref-candidate-claim-missing"
      })
    ]);

    await expect(summarizeSourceCandidateCurationHandoff()).resolves.toEqual({
      groups: [
        {
          count: 1,
          publicSourcePacketReady: false,
          status: "Accepted reference missing"
        },
        {
          count: 1,
          publicSourcePacketReady: false,
          status: "Accepted reference mismatch"
        },
        {
          count: 1,
          publicSourcePacketReady: false,
          status: "Candidate claim missing"
        },
        {
          count: 1,
          publicSourcePacketReady: false,
          status: "Claim link missing"
        },
        {
          count: 1,
          publicSourcePacketReady: false,
          status: "Extraction pending"
        },
        {
          count: 1,
          publicSourcePacketReady: true,
          status: "Public source packet ready"
        }
      ],
      total: 6
    });

    expect(prismaMocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        decision: "ACCEPTED"
      },
      orderBy: [{ reviewedAt: "asc" }, { updatedAt: "desc" }]
    });
  });

  it("returns an empty curation handoff summary without reading curation tables", async () => {
    prismaMocks.sourceCandidateFindMany.mockResolvedValue([]);

    await expect(summarizeSourceCandidateCurationHandoff()).resolves.toEqual({
      groups: [],
      total: 0
    });

    expect(prismaMocks.referenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.claimReferenceFindMany).not.toHaveBeenCalled();
    expect(prismaMocks.studyFindMany).not.toHaveBeenCalled();
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

  it("requires a nonblank review note when rejecting candidates", async () => {
    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Rejected"
      })
    ).rejects.toThrow("Rejected source candidates require a reviewNote.");

    await expect(
      recordSourceCandidateDecision({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Rejected",
        reviewNote: " "
      })
    ).rejects.toThrow("Rejected source candidates require a reviewNote.");

    expect(prismaMocks.sourceCandidateFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.sourceCandidateUpdate).not.toHaveBeenCalled();
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

function dbClaimReference(overrides: Record<string, unknown> = {}) {
  return {
    claimId: "creatine-strength",
    referenceId: "ref-creatine-position-stand",
    relevance: 5,
    note: null,
    ...overrides
  };
}

function dbClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: "creatine-strength",
    interventionId: "creatine",
    ...overrides
  };
}

function studyExtractionInput(
  overrides: Partial<Parameters<typeof extractAcceptedSourceCandidateStudy>[0]> = {}
): Parameters<typeof extractAcceptedSourceCandidateStudy>[0] {
  return {
    adverseEvents: "No serious adverse events reported.",
    dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
    fundingConflicts: "Not independently extracted.",
    interventionName: "Creatine",
    outcomes: ["Strength"],
    population: "Healthy adults",
    riskOfBias: "Review-level evidence; manual extraction needed.",
    sampleSize: "Multiple studies",
    ...overrides
  };
}

function dbStudy(overrides: Record<string, unknown> = {}) {
  return {
    id: "study-creatine-issn",
    referenceId: "ref-creatine-position-stand",
    title: "Creatine position stand extraction",
    year: 2017,
    source: "PubMed",
    sourceType: "SYSTEMATIC_REVIEW",
    pmid: "28615996",
    pmcid: null,
    doi: null,
    nctId: null,
    url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    abstract: null,
    sampleSize: "n/a",
    population: "Healthy adults",
    interventionName: "Creatine",
    dose: null,
    duration: null,
    outcomes: ["Strength"],
    mainResults: null,
    adverseEvents: "Not reported",
    fundingConflicts: "Not extracted",
    riskOfBias: "Not extracted",
    relevanceScore: 5,
    extractedAbstract: null,
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides
  };
}
