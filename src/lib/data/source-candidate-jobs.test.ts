import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimFindUnique: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  groupBy: vi.fn(),
  interventionFindUnique: vi.fn(),
  sourceCandidateFindMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  ingestClinicalTrialSourceCandidates: vi.fn(),
  ingestPubMedSourceCandidates: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    claim: {
      findUnique: mocks.claimFindUnique
    },
    ingestionJob: {
      create: mocks.create,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      groupBy: mocks.groupBy,
      update: mocks.update,
      updateMany: mocks.updateMany
    },
    sourceCandidate: {
      findMany: mocks.sourceCandidateFindMany
    },
    intervention: {
      findUnique: mocks.interventionFindUnique
    }
  }
}));

vi.mock("@/lib/data/source-candidate-ingestion", () => ({
  ingestClinicalTrialSourceCandidates: mocks.ingestClinicalTrialSourceCandidates,
  ingestPubMedSourceCandidates: mocks.ingestPubMedSourceCandidates
}));

import {
  listSourceCandidateIngestionJobs,
  queueInterventionSourceCandidateDiscoveryJobs,
  queuePubMedDeepeningCatchUpJobs,
  queueClaimSourceCandidateIngestionJobs,
  queueSourceCandidateIngestionJob,
  runNextSourceCandidateIngestionJob,
  runSourceCandidateIngestionJob,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";

const timestamp = new Date("2026-06-02T03:00:00.000Z");
const now = () => timestamp;

describe("listSourceCandidateIngestionJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists recent supported source-candidate ingestion jobs with stable fields", async () => {
    mocks.findMany.mockResolvedValue([
      dbIngestionJob({
        status: "SUCCEEDED",
        startedAt: new Date("2026-06-02T01:00:00.000Z"),
        completedAt: new Date("2026-06-02T01:02:00.000Z"),
        updatedAt: new Date("2026-06-02T01:02:00.000Z"),
        recordsFound: 5,
        recordsChanged: 3
      }),
      dbIngestionJob({
        id: "job-trials",
        source: "CLINICALTRIALS_GOV",
        status: "FAILED",
        query: "creatine aging",
        interventionId: null,
        claimId: null,
        metadata: null,
        recordsFound: 0,
        recordsChanged: 0,
        error: "ClinicalTrials unavailable",
        createdAt: new Date("2026-06-02T02:00:00.000Z"),
        updatedAt: new Date("2026-06-02T02:01:00.000Z")
      })
    ]);

    await expect(listSourceCandidateIngestionJobs()).resolves.toEqual([
      {
        claimId: "creatine-strength",
        completedAt: "2026-06-02T01:02:00.000Z",
        createdAt: "2026-06-02T00:00:00.000Z",
        error: undefined,
        interventionId: "creatine",
        jobId: "job-pubmed",
        query: "creatine strength",
        recordsChanged: 3,
        recordsFound: 5,
        region: "AU",
        source: "PUBMED",
        startedAt: "2026-06-02T01:00:00.000Z",
        status: "SUCCEEDED",
        updatedAt: "2026-06-02T01:02:00.000Z"
      },
      {
        claimId: undefined,
        completedAt: undefined,
        createdAt: "2026-06-02T02:00:00.000Z",
        error: "ClinicalTrials unavailable",
        interventionId: undefined,
        jobId: "job-trials",
        query: "creatine aging",
        recordsChanged: 0,
        recordsFound: 0,
        region: "AU",
        source: "CLINICALTRIALS_GOV",
        startedAt: undefined,
        status: "FAILED",
        updatedAt: "2026-06-02T02:01:00.000Z"
      }
    ]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });
  });

  it("bounds the source-candidate ingestion job list limit", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listSourceCandidateIngestionJobs({ limit: 250 });

    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 50
      })
    );

    await listSourceCandidateIngestionJobs({ limit: 0 });

    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 1
      })
    );
  });

  it("filters source-candidate ingestion jobs by status", async () => {
    mocks.findMany.mockResolvedValue([
      dbIngestionJob({
        status: "QUEUED"
      })
    ]);

    await listSourceCandidateIngestionJobs({
      status: "QUEUED"
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        },
        status: "QUEUED"
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });
  });

  it("filters source-candidate ingestion jobs by source, region, and context", async () => {
    mocks.findMany.mockResolvedValue([
      dbIngestionJob({
        status: "QUEUED"
      })
    ]);

    await listSourceCandidateIngestionJobs({
      claimId: " creatine-strength ",
      interventionId: "creatine",
      region: "au",
      source: "PubMed",
      status: "QUEUED"
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength",
        status: "QUEUED"
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });
  });

  it("returns an empty job list", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(listSourceCandidateIngestionJobs()).resolves.toEqual([]);
  });
});

describe("summarizeSourceCandidateIngestionJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes supported ingestion jobs by status, source, and region", async () => {
    mocks.groupBy.mockResolvedValue([
      {
        _count: {
          _all: 2
        },
        region: "AU",
        source: "CLINICALTRIALS_GOV",
        status: "QUEUED"
      },
      {
        _count: {
          _all: 1
        },
        region: "AU",
        source: "PUBMED",
        status: "SUCCEEDED"
      },
      {
        _count: {
          _all: 3
        },
        region: "NZ",
        source: "PUBMED",
        status: "QUEUED"
      }
    ]);

    await expect(summarizeSourceCandidateIngestionJobs()).resolves.toEqual({
      groups: [
        {
          count: 3,
          region: "NZ",
          source: "PUBMED",
          status: "QUEUED"
        },
        {
          count: 2,
          region: "AU",
          source: "CLINICALTRIALS_GOV",
          status: "QUEUED"
        },
        {
          count: 1,
          region: "AU",
          source: "PUBMED",
          status: "SUCCEEDED"
        }
      ],
      total: 6
    });

    expect(mocks.groupBy).toHaveBeenCalledWith({
      by: ["source", "status", "region"],
      where: {
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        }
      },
      _count: {
        _all: true
      }
    });
  });

  it("returns an empty summary", async () => {
    mocks.groupBy.mockResolvedValue([]);

    await expect(summarizeSourceCandidateIngestionJobs()).resolves.toEqual({
      groups: [],
      total: 0
    });
  });
});

describe("queueSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimFindUnique.mockResolvedValue({
      interventionId: "creatine"
    });
    mocks.interventionFindUnique.mockResolvedValue({
      id: "creatine"
    });
  });

  it("creates a queued PubMed ingestion job when one does not already exist", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(dbIngestionJob());

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "  creatine   strength  ",
        region: "au",
        interventionId: " creatine ",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: true,
      interventionId: "creatine",
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }
    });
    expect(mocks.claimFindUnique).toHaveBeenCalledWith({
      where: {
        id: "creatine-strength"
      },
      select: {
        interventionId: true
      }
    });
    expect(mocks.interventionFindUnique).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "creatine",
          claimId: "creatine-strength"
        }
      }
    });
  });

  it("creates ClinicalTrials.gov jobs with default AU region and sparse metadata", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(
      dbIngestionJob({
        id: "job-trials",
        source: "CLINICALTRIALS_GOV",
        query: "creatine aging",
        interventionId: null,
        claimId: null,
        metadata: {}
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "ClinicalTrials.gov",
        query: "creatine aging"
      })
    ).resolves.toEqual({
      claimId: undefined,
      contextMismatchFields: [],
      created: true,
      interventionId: undefined,
      jobId: "job-trials",
      source: "CLINICALTRIALS_GOV",
      query: "creatine aging",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "CLINICALTRIALS_GOV",
        status: "QUEUED",
        query: "creatine aging",
        region: "AU",
        interventionId: undefined,
        claimId: undefined,
        metadata: {}
      }
    });
    expect(mocks.claimFindUnique).not.toHaveBeenCalled();
    expect(mocks.interventionFindUnique).not.toHaveBeenCalled();
  });

  it("creates intervention-scoped jobs after validating the intervention", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(
      dbIngestionJob({
        id: "job-pubmed-creatine",
        interventionId: "creatine",
        claimId: null,
        metadata: {
          interventionId: "creatine"
        }
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine"
      })
    ).resolves.toEqual({
      claimId: undefined,
      contextMismatchFields: [],
      created: true,
      interventionId: "creatine",
      jobId: "job-pubmed-creatine",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.claimFindUnique).not.toHaveBeenCalled();
    expect(mocks.interventionFindUnique).toHaveBeenCalledWith({
      where: {
        id: "creatine"
      },
      select: {
        id: true
      }
    });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: null
      }
    });
  });

  it("creates claim-scoped jobs after validating the claim", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(
      dbIngestionJob({
        id: "job-pubmed-creatine-strength-claim",
        interventionId: null,
        claimId: "creatine-strength",
        metadata: {
          claimId: "creatine-strength"
        }
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: true,
      interventionId: undefined,
      jobId: "job-pubmed-creatine-strength-claim",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.claimFindUnique).toHaveBeenCalledWith({
      where: {
        id: "creatine-strength"
      },
      select: {
        interventionId: true
      }
    });
    expect(mocks.interventionFindUnique).not.toHaveBeenCalled();
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        interventionId: null,
        claimId: "creatine-strength"
      }
    });
  });

  it("rejects queue context when the claim is missing", async () => {
    mocks.claimFindUnique.mockResolvedValue(null);

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        claimId: "missing-claim"
      })
    ).rejects.toThrow("Source-candidate ingestion job claim not found: missing-claim.");

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects queue context when the intervention is missing", async () => {
    mocks.interventionFindUnique.mockResolvedValue(null);

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "missing-intervention"
      })
    ).rejects.toThrow(
      "Source-candidate ingestion job intervention not found: missing-intervention."
    );

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects queue context when the claim belongs to a different intervention", async () => {
    mocks.claimFindUnique.mockResolvedValue({
      interventionId: "glycine"
    });

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "glycine-sleep"
      })
    ).rejects.toThrow(
      "Source-candidate ingestion job claim glycine-sleep does not belong to intervention creatine."
    );

    expect(mocks.interventionFindUnique).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a scoped job instead of returning an unscoped source/query/region match", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(
      dbIngestionJob({
        id: "job-pubmed-creatine-strength",
        status: "QUEUED",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "creatine",
          claimId: "creatine-strength"
        }
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: true,
      interventionId: "creatine",
      jobId: "job-pubmed-creatine-strength",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "creatine strength",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "creatine",
          claimId: "creatine-strength"
        }
      }
    });
  });

  it("returns a concurrently-created job when the context unique index wins a race", async () => {
    const uniqueError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002"
    });
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        dbIngestionJob({
          id: "job-raced",
          status: "QUEUED"
        })
      );
    mocks.create.mockRejectedValue(uniqueError);

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: false,
      interventionId: "creatine",
      jobId: "job-raced",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });

    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });

  it("rethrows unique races when the context-matched job cannot be refetched", async () => {
    const uniqueError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002"
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockRejectedValue(uniqueError);

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ).rejects.toThrow("Unique constraint failed");

    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });

  it("returns an existing context-matched job without resetting status or metadata", async () => {
    mocks.findFirst.mockResolvedValue(
      dbIngestionJob({
        status: "SUCCEEDED",
        recordsFound: 5,
        recordsChanged: 5
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: false,
      interventionId: "creatine",
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("returns existing job context without mismatch when requested context matches", async () => {
    mocks.findFirst.mockResolvedValue(
      dbIngestionJob({
        status: "SUCCEEDED"
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: " creatine ",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: false,
      interventionId: "creatine",
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });
  });

  it("uses first-class context instead of stale metadata", async () => {
    mocks.findFirst.mockResolvedValue(
      dbIngestionJob({
        status: "SUCCEEDED",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "stale-intervention",
          claimId: "stale-claim"
        }
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      contextMismatchFields: [],
      created: false,
      interventionId: "creatine",
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });
  });

  it("returns existing unscoped jobs when no queue context is requested", async () => {
    mocks.findFirst.mockResolvedValue(
      dbIngestionJob({
        status: "SUCCEEDED",
        interventionId: null,
        claimId: null,
        metadata: {}
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength"
      })
    ).resolves.toEqual({
      claimId: undefined,
      contextMismatchFields: [],
      created: false,
      interventionId: undefined,
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        interventionId: null,
        claimId: null
      }
    });
  });

  it("ignores blank or malformed stored context when reporting existing jobs", async () => {
    mocks.findFirst.mockResolvedValue(
      dbIngestionJob({
        interventionId: null,
        claimId: null,
        metadata: {
          interventionId: " ",
          claimId: 123
        }
      })
    );

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "creatine strength"
      })
    ).resolves.toEqual({
      claimId: undefined,
      contextMismatchFields: [],
      created: false,
      interventionId: undefined,
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });
  });

  it("rejects empty and overlong queue terms", async () => {
    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: " "
      })
    ).rejects.toThrow("Source-candidate ingestion job query is required.");

    await expect(
      queueSourceCandidateIngestionJob({
        source: "PubMed",
        query: "a".repeat(241)
      })
    ).rejects.toThrow(
      "Source-candidate ingestion job query must be 240 characters or fewer."
    );

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("queueClaimSourceCandidateIngestionJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues PubMed and ClinicalTrials.gov jobs from claim context", async () => {
    const expectedPubMedTerms = [
      "Creatine monohydrate randomized clinical trial systematic review meta-analysis",
      "Creatine monohydrate strength resistance training lean mass gains systematic review meta-analysis",
      "Creatine monohydrate strength exercise performance systematic review meta-analysis",
      "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review",
      "Creatine monohydrate safety adverse effects interactions strength gains resistance training contraindications",
      "Creatine monohydrate resistance training strength lean mass placebo randomized trial",
      "Creatine monohydrate trained adults exercise performance renal safety tolerability"
    ];
    const expectedTrialTerm =
      "Creatine monohydrate strength resistance training lean mass gains";
    const createdJobs = [
      ...expectedPubMedTerms.map((query, index) =>
        dbIngestionJob({
          id: `job-pubmed-creatine-strength-${index + 1}`,
          query
        })
      ),
      dbIngestionJob({
        id: "job-trials-creatine-strength",
        source: "CLINICALTRIALS_GOV",
        query: expectedTrialTerm
      })
    ];
    let createIndex = 0;

    mocks.claimFindUnique
      .mockResolvedValueOnce({
        id: "creatine-strength",
        claimText: "Supports strength gains with resistance training.",
        outcome: "MUSCLE_STRENGTH",
        intervention: {
          id: "creatine",
          category: "AMINO_ACID",
          name: "Creatine monohydrate",
          synonyms: ["creatine"]
        }
      })
      .mockResolvedValue({
        interventionId: "creatine"
      });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async () => createdJobs[createIndex++]);

    await expect(
      queueClaimSourceCandidateIngestionJobs({
        claimId: " creatine-strength ",
        region: "au"
      })
    ).resolves.toEqual({
      claimId: "creatine-strength",
      interventionId: "creatine",
      label: "Creatine monohydrate - Muscle/strength",
      pubMedTerm:
        "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review",
      pubMedTerms: expectedPubMedTerms,
      region: "AU",
      trialTerm: expectedTrialTerm,
      jobs: [
        ...expectedPubMedTerms.map((query, index) => ({
          claimId: "creatine-strength",
          contextMismatchFields: [],
          created: true,
          interventionId: "creatine",
          jobId: `job-pubmed-creatine-strength-${index + 1}`,
          source: "PUBMED",
          query,
          region: "AU",
          status: "QUEUED"
        })),
        {
          claimId: "creatine-strength",
          contextMismatchFields: [],
          created: true,
          interventionId: "creatine",
          jobId: "job-trials-creatine-strength",
          source: "CLINICALTRIALS_GOV",
          query: "Creatine monohydrate strength resistance training lean mass gains",
          region: "AU",
          status: "QUEUED"
        }
      ]
    });

    expect(mocks.claimFindUnique).toHaveBeenNthCalledWith(1, {
      where: {
        id: "creatine-strength"
      },
      select: {
        claimText: true,
        id: true,
        outcome: true,
        intervention: {
          select: {
            id: true,
            category: true,
            name: true,
            synonyms: true
          }
        }
      }
    });
    for (const [index, query] of expectedPubMedTerms.entries()) {
      expect(mocks.create).toHaveBeenNthCalledWith(index + 1, {
        data: {
          source: "PUBMED",
          status: "QUEUED",
          query,
          region: "AU",
          interventionId: "creatine",
          claimId: "creatine-strength",
          metadata: {
            interventionId: "creatine",
            claimId: "creatine-strength"
          }
        }
      });
    }
    expect(mocks.create).toHaveBeenNthCalledWith(expectedPubMedTerms.length + 1, {
      data: {
        source: "CLINICALTRIALS_GOV",
        status: "QUEUED",
        query: expectedTrialTerm,
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "creatine",
          claimId: "creatine-strength"
        }
      }
    });
  });

  it("rejects missing claim ids before queueing", async () => {
    await expect(
      queueClaimSourceCandidateIngestionJobs({
        claimId: " "
      })
    ).rejects.toThrow("Claim id is required to queue claim source-candidate jobs.");

    expect(mocks.claimFindUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects missing claims before queueing", async () => {
    mocks.claimFindUnique.mockResolvedValue(null);

    await expect(
      queueClaimSourceCandidateIngestionJobs({
        claimId: "missing-claim"
      })
    ).rejects.toThrow("Source-candidate ingestion job claim not found: missing-claim.");

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("queueInterventionSourceCandidateDiscoveryJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues broad benefit discovery jobs against an intervention without preselecting a claim", async () => {
    let createIndex = 0;

    mocks.interventionFindUnique.mockResolvedValue({
      id: "astaxanthin",
      category: "BOTANICAL_HERBAL",
      name: "Astaxanthin",
      synonyms: []
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) => {
      createIndex += 1;
      return dbIngestionJob({
        id: `job-discovery-${createIndex}`,
        source: data.source,
        query: data.query,
        interventionId: data.interventionId,
        claimId: data.claimId ?? null,
        metadata: data.metadata
      });
    });

    const result = await queueInterventionSourceCandidateDiscoveryJobs({
      interventionId: " astaxanthin ",
      region: "au"
    });

    expect(result).toMatchObject({
      interventionId: "astaxanthin",
      label: "Astaxanthin - broad benefit discovery",
      region: "AU",
      searchTerm: "Astaxanthin",
      trialTerm: "Astaxanthin"
    });
    expect(result.pubMedTerms[0]).toBe("Astaxanthin");
    expect(result.pubMedTerms).toContain("Astaxanthin eye strain randomized placebo");
    expect(result.jobs.some((job) => job.claimId)).toBe(false);
    expect(result.jobs.some((job) => job.source === "CLINICALTRIALS_GOV")).toBe(true);
    expect(mocks.interventionFindUnique).toHaveBeenCalledWith({
      where: {
        id: "astaxanthin"
      },
      select: {
        id: true,
        category: true,
        name: true,
        synonyms: true
      }
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "Astaxanthin",
        region: "AU",
        interventionId: "astaxanthin",
        claimId: undefined,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      }
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "Astaxanthin eye strain randomized placebo",
        region: "AU",
        interventionId: "astaxanthin",
        claimId: undefined,
        metadata: {
          interventionId: "astaxanthin"
        }
      }
    });
  });

  it("queues broad benefit discovery jobs against a saved intervention synonym", async () => {
    let createIndex = 0;

    mocks.interventionFindUnique.mockResolvedValue({
      id: "omega-3",
      category: "FATTY_ACID",
      name: "Omega-3 EPA/DHA",
      synonyms: ["fish oil", "EPA DHA"]
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) => {
      createIndex += 1;
      return dbIngestionJob({
        id: `job-fish-oil-discovery-${createIndex}`,
        source: data.source,
        query: data.query,
        interventionId: data.interventionId,
        claimId: data.claimId ?? null,
        metadata: data.metadata
      });
    });

    const result = await queueInterventionSourceCandidateDiscoveryJobs({
      interventionId: "omega-3",
      region: "au",
      searchTerm: "fish oil"
    });

    expect(result).toMatchObject({
      interventionId: "omega-3",
      label: "fish oil - broad benefit discovery",
      region: "AU",
      searchTerm: "fish oil",
      trialTerm: "fish oil"
    });
    expect(result.pubMedTerms[0]).toBe("fish oil");
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "fish oil",
        region: "AU",
        interventionId: "omega-3",
        claimId: undefined,
        metadata: {
          interventionId: "omega-3",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      }
    });
    expect(result.pubMedTerms).toContain("fish oil randomized placebo clinical trial");
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "fish oil randomized placebo clinical trial",
        region: "AU",
        interventionId: "omega-3",
        claimId: undefined,
        metadata: {
          interventionId: "omega-3"
        }
      }
    });
  });

  it("rejects intervention discovery search terms that are not saved synonyms", async () => {
    mocks.interventionFindUnique.mockResolvedValue({
      id: "omega-3",
      category: "FATTY_ACID",
      name: "Omega-3 EPA/DHA",
      synonyms: ["fish oil"]
    });

    await expect(
      queueInterventionSourceCandidateDiscoveryJobs({
        interventionId: "omega-3",
        searchTerm: "krill oil"
      })
    ).rejects.toThrow(
      "Intervention discovery search term must be the intervention name or a saved synonym."
    );

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects missing intervention ids before queueing discovery", async () => {
    await expect(
      queueInterventionSourceCandidateDiscoveryJobs({
        interventionId: " "
      })
    ).rejects.toThrow("Intervention id is required to queue intervention discovery jobs.");

    expect(mocks.interventionFindUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("runNextSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns null when there is no queued supported source-candidate job", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(runNextSourceCandidateIngestionJob({ now })).resolves.toBeNull();

    expect(mocks.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        status: "QUEUED",
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        },
        metadata: {
          path: ["sourceCandidateDiscoveryPriority"],
          equals: "supplement-name"
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });
    expect(mocks.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        status: "QUEUED",
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        },
        metadata: {
          path: ["sourceCandidateDiscoveryPriority"],
          equals: "pubmed-deepening"
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });
    expect(mocks.findFirst).toHaveBeenNthCalledWith(3, {
      where: {
        status: "QUEUED",
        source: {
          in: ["PUBMED", "CLINICALTRIALS_GOV"]
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("runs the oldest queued supported job", async () => {
    mocks.findFirst.mockResolvedValue(dbIngestionJob());
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(sourceCandidateIngestionResult());

    await expect(
      runNextSourceCandidateIngestionJob({
        now,
        pubMedRetmax: 5
      })
    ).resolves.toMatchObject({
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED",
      recordsFound: 1,
      recordsChanged: 1
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-pubmed",
        status: "QUEUED"
      },
      data: {
        status: "RUNNING",
        startedAt: timestamp,
        completedAt: null,
        recordsFound: 0,
        recordsChanged: 0,
        error: null
      }
    });
    expect(mocks.ingestPubMedSourceCandidates).toHaveBeenCalledWith({
      term: "creatine strength",
      retmax: 5,
      region: "AU",
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed",
      retstart: 0
    });
  });

  it("falls back to the oldest queued supported job when no supplement-name priority job is queued", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(dbIngestionJob());
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(sourceCandidateIngestionResult());

    await expect(runNextSourceCandidateIngestionJob({ now })).resolves.toMatchObject({
      jobId: "job-pubmed",
      status: "SUCCEEDED"
    });

    expect(mocks.findFirst).toHaveBeenCalledTimes(3);
    expect(mocks.ingestPubMedSourceCandidates).toHaveBeenCalledWith({
      term: "creatine strength",
      retmax: 20,
      region: "AU",
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed",
      retstart: 0
    });
  });

  it("does not run external ingestion when a selected next job cannot be claimed", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(dbIngestionJob())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(runNextSourceCandidateIngestionJob({ now })).resolves.toBeNull();

    expect(mocks.findFirst).toHaveBeenCalledTimes(4);
    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.ingestClinicalTrialSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("queuePubMedDeepeningCatchUpJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.interventionFindUnique.mockResolvedValue({ id: "astaxanthin" });
  });

  it("queues page two for completed full supplement-name PubMed jobs with useful candidates", async () => {
    mocks.findMany.mockResolvedValue([
      dbIngestionJob({
        id: "job-astaxanthin-page-1",
        query: "Astaxanthin",
        status: "SUCCEEDED",
        recordsFound: 20,
        interventionId: "astaxanthin",
        claimId: null,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      })
    ]);
    mocks.sourceCandidateFindMany.mockResolvedValue(
      deepeningCandidates(20, "likely-useful").map(({ metadata, triageScore }) => ({
        metadata,
        triageScore
      }))
    );
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) =>
      dbIngestionJob({
        id: "job-astaxanthin-page-2",
        source: data.source,
        query: data.query,
        region: data.region,
        interventionId: data.interventionId,
        claimId: data.claimId ?? null,
        metadata: data.metadata
      })
    );

    await expect(queuePubMedDeepeningCatchUpJobs({ pageSize: 20 })).resolves.toMatchObject({
      eligibleJobs: 1,
      existingJobs: 0,
      jobCount: 1,
      newJobs: 1,
      skippedJobs: 0,
      sampleJobs: [
        expect.objectContaining({
          interventionId: "astaxanthin",
          query: "Astaxanthin [PubMed results 21-40]",
          source: "PUBMED"
        })
      ]
    });

    expect(mocks.sourceCandidateFindMany).toHaveBeenCalledWith({
      where: {
        source: "PUBMED",
        query: "Astaxanthin",
        region: "AU",
        interventionId: "astaxanthin",
        claimId: null
      },
      orderBy: [{ triageScore: "desc" }, { discoveredAt: "desc" }],
      take: 20,
      select: {
        metadata: true,
        triageScore: true
      }
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "Astaxanthin [PubMed results 21-40]",
        region: "AU",
        interventionId: "astaxanthin",
        claimId: undefined,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "pubmed-deepening",
          sourceCandidateSearchTerm: "Astaxanthin",
          pubMedRetstart: 20
        }
      }
    });
  });

  it("skips completed full PubMed jobs when their saved candidates are mostly noise", async () => {
    mocks.findMany.mockResolvedValue([
      dbIngestionJob({
        id: "job-bpc-page-1",
        query: "BPC-157",
        status: "SUCCEEDED",
        recordsFound: 20,
        interventionId: "bpc-157",
        claimId: null,
        metadata: {
          interventionId: "bpc-157",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      })
    ]);
    mocks.sourceCandidateFindMany.mockResolvedValue(
      deepeningCandidates(20, "likely-noise").map(({ metadata, triageScore }) => ({
        metadata,
        triageScore
      }))
    );

    await expect(queuePubMedDeepeningCatchUpJobs({ pageSize: 20 })).resolves.toMatchObject({
      eligibleJobs: 1,
      existingJobs: 0,
      jobCount: 0,
      newJobs: 0,
      skippedJobs: 1
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("runSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks PubMed jobs running and then succeeded with persisted counts", async () => {
    mocks.findUnique.mockResolvedValue(dbIngestionJob());
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(sourceCandidateIngestionResult());

    await expect(
      runSourceCandidateIngestionJob("job-pubmed", {
        now,
        pubMedRetmax: 10
      })
    ).resolves.toEqual({
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED",
      recordsFound: 1,
      recordsChanged: 1,
      deepening: {
        candidateCount: 1,
        maxResults: 100,
        pageSize: 10,
        pageStart: 0,
        queued: false,
        reason: "current PubMed page was not full",
        usefulCandidateCount: 0,
        usefulRatio: 0
      },
      error: undefined
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-pubmed",
        status: "QUEUED"
      },
      data: {
        status: "RUNNING",
        startedAt: timestamp,
        completedAt: null,
        recordsFound: 0,
        recordsChanged: 0,
        error: null
      }
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "job-pubmed"
      },
      data: {
        status: "SUCCEEDED",
        completedAt: timestamp,
        recordsFound: 1,
        recordsChanged: 1,
        error: null
      }
    });
  });

  it("routes ClinicalTrials.gov jobs through the clinical trial ingestion helper", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        id: "job-trials",
        source: "CLINICALTRIALS_GOV",
        query: "creatine aging",
        interventionId: null,
        claimId: null,
        metadata: null
      })
    );
    mocks.ingestClinicalTrialSourceCandidates.mockResolvedValue(
      sourceCandidateIngestionResult({
        source: "ClinicalTrials.gov",
        query: "creatine aging",
        candidates: [{ dedupeKey: "clinicaltrials.gov|au|creatine|nct123" }],
        upsert: {
          received: 1,
          upserted: 1
        }
      })
    );

    await expect(
      runSourceCandidateIngestionJob("job-trials", {
        clinicalTrialPageSize: 3,
        now
      })
    ).resolves.toMatchObject({
      jobId: "job-trials",
      status: "SUCCEEDED",
      recordsFound: 1,
      recordsChanged: 1
    });

    expect(mocks.ingestClinicalTrialSourceCandidates).toHaveBeenCalledWith({
      term: "creatine aging",
      pageSize: 3,
      region: "AU",
      interventionId: undefined,
      claimId: undefined,
      ingestionJobId: "job-trials"
    });
    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
  });

  it("runs first-class job context instead of stale metadata", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "stale-intervention",
          claimId: "stale-claim"
        }
      })
    );
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(sourceCandidateIngestionResult());

    await expect(
      runSourceCandidateIngestionJob("job-pubmed", { now })
    ).resolves.toMatchObject({
      jobId: "job-pubmed",
      status: "SUCCEEDED"
    });

    expect(mocks.ingestPubMedSourceCandidates).toHaveBeenCalledWith({
      term: "creatine strength",
      retmax: 20,
      region: "AU",
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed",
      retstart: 0
    });
  });

  it("queues the next PubMed page when a full page still looks useful", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        query: "Astaxanthin",
        interventionId: "astaxanthin",
        claimId: null,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      })
    );
    mocks.interventionFindUnique.mockResolvedValue({ id: "astaxanthin" });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(async ({ data }) =>
      dbIngestionJob({
        id: "job-astaxanthin-page-2",
        source: data.source,
        query: data.query,
        region: data.region,
        interventionId: data.interventionId,
        claimId: data.claimId ?? null,
        metadata: data.metadata
      })
    );
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(
      sourceCandidateIngestionResult({
        query: "Astaxanthin",
        totalCount: 52,
        pageStart: 0,
        candidates: deepeningCandidates(20, "likely-useful"),
        upsert: {
          received: 20,
          upserted: 20
        }
      })
    );

    await expect(runSourceCandidateIngestionJob("job-pubmed", { now })).resolves.toMatchObject({
      jobId: "job-pubmed",
      status: "SUCCEEDED",
      recordsFound: 20,
      recordsChanged: 20,
      deepening: {
        nextPageStart: 20,
        queued: true,
        reason: "queued next PubMed result page"
      }
    });

    expect(mocks.ingestPubMedSourceCandidates).toHaveBeenCalledWith({
      term: "Astaxanthin",
      retmax: 20,
      region: "AU",
      interventionId: "astaxanthin",
      claimId: undefined,
      ingestionJobId: "job-pubmed",
      retstart: 0
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query: "Astaxanthin [PubMed results 21-40]",
        region: "AU",
        interventionId: "astaxanthin",
        claimId: undefined,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "pubmed-deepening",
          sourceCandidateSearchTerm: "Astaxanthin",
          pubMedRetstart: 20
        }
      }
    });
  });

  it("uses the stored PubMed search term and retstart for deeper page jobs", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        query: "Astaxanthin [PubMed results 21-40]",
        interventionId: "astaxanthin",
        claimId: null,
        metadata: {
          interventionId: "astaxanthin",
          sourceCandidateDiscoveryPriority: "pubmed-deepening",
          sourceCandidateSearchTerm: "Astaxanthin",
          pubMedRetstart: 20
        }
      })
    );
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(
      sourceCandidateIngestionResult({
        query: "Astaxanthin",
        totalCount: 32,
        pageStart: 20,
        candidates: deepeningCandidates(12, "likely-useful"),
        upsert: {
          received: 12,
          upserted: 12
        }
      })
    );

    await expect(runSourceCandidateIngestionJob("job-pubmed", { now })).resolves.toMatchObject({
      jobId: "job-pubmed",
      status: "SUCCEEDED",
      recordsFound: 12,
      deepening: {
        queued: false,
        reason: "current PubMed page was not full"
      }
    });

    expect(mocks.ingestPubMedSourceCandidates).toHaveBeenCalledWith({
      term: "Astaxanthin",
      retmax: 20,
      region: "AU",
      interventionId: "astaxanthin",
      claimId: undefined,
      ingestionJobId: "job-pubmed",
      retstart: 20
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("stops deeper PubMed paging when a full page is mostly noise", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        query: "BPC-157",
        interventionId: "bpc-157",
        claimId: null,
        metadata: {
          interventionId: "bpc-157",
          sourceCandidateDiscoveryPriority: "supplement-name"
        }
      })
    );
    mocks.ingestPubMedSourceCandidates.mockResolvedValue(
      sourceCandidateIngestionResult({
        query: "BPC-157",
        totalCount: 80,
        pageStart: 0,
        candidates: deepeningCandidates(20, "likely-noise"),
        upsert: {
          received: 20,
          upserted: 20
        }
      })
    );

    await expect(runSourceCandidateIngestionJob("job-pubmed", { now })).resolves.toMatchObject({
      jobId: "job-pubmed",
      status: "SUCCEEDED",
      recordsFound: 20,
      deepening: {
        queued: false,
        reason: "current PubMed page did not have enough useful-looking candidates"
      }
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("marks unsupported source-candidate jobs skipped", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        id: "job-tga",
        source: "TGA",
        query: "safety alerts peptides"
      })
    );

    await expect(
      runSourceCandidateIngestionJob("job-tga", { now })
    ).resolves.toEqual({
      jobId: "job-tga",
      source: "TGA",
      query: "safety alerts peptides",
      region: "AU",
      status: "SKIPPED",
      recordsFound: 0,
      recordsChanged: 0,
      error: "Source candidate ingestion is not implemented for TGA."
    });

    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.ingestClinicalTrialSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenLastCalledWith({
      where: {
        id: "job-tga"
      },
      data: {
        status: "SKIPPED",
        completedAt: timestamp,
        recordsFound: 0,
        recordsChanged: 0,
        error: "Source candidate ingestion is not implemented for TGA."
      }
    });
  });

  it("marks failed jobs failed and returns the error without throwing", async () => {
    mocks.findUnique.mockResolvedValue(dbIngestionJob());
    mocks.ingestPubMedSourceCandidates.mockRejectedValue(new Error("NCBI unavailable"));

    await expect(
      runSourceCandidateIngestionJob("job-pubmed", { now })
    ).resolves.toEqual({
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "FAILED",
      recordsFound: 0,
      recordsChanged: 0,
      error: "NCBI unavailable"
    });

    expect(mocks.update).toHaveBeenLastCalledWith({
      where: {
        id: "job-pubmed"
      },
      data: {
        status: "FAILED",
        completedAt: timestamp,
        recordsFound: 0,
        recordsChanged: 0,
        error: "NCBI unavailable"
      }
    });
  });

  it("throws when the requested ingestion job does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      runSourceCandidateIngestionJob("missing-job", { now })
    ).rejects.toThrow("Ingestion job not found: missing-job");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("throws before claiming when the requested ingestion job is not queued", async () => {
    mocks.findUnique.mockResolvedValue(
      dbIngestionJob({
        status: "SUCCEEDED"
      })
    );

    await expect(
      runSourceCandidateIngestionJob("job-pubmed", { now })
    ).rejects.toThrow("Ingestion job is not queued: job-pubmed has status SUCCEEDED.");

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
  });

  it("throws without running external ingestion when a queued job claim is lost", async () => {
    mocks.findUnique.mockResolvedValue(dbIngestionJob());
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      runSourceCandidateIngestionJob("job-pubmed", { now })
    ).rejects.toThrow("Could not claim queued ingestion job: job-pubmed.");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.ingestClinicalTrialSourceCandidates).not.toHaveBeenCalled();
  });
});

function dbIngestionJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-pubmed",
    source: "PUBMED",
    status: "QUEUED",
    query: "creatine strength",
    region: "AU",
    interventionId: "creatine",
    claimId: "creatine-strength",
    startedAt: null,
    completedAt: null,
    recordsFound: 0,
    recordsChanged: 0,
    error: null,
    metadata: {
      interventionId: "creatine",
      claimId: "creatine-strength"
    },
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides
  };
}

function sourceCandidateIngestionResult(overrides: Record<string, unknown> = {}) {
  return {
    source: "PubMed",
    query: "creatine strength",
    candidates: [{ dedupeKey: "pubmed|au|creatine|28615996" }],
    upsert: {
      received: 1,
      upserted: 1
    },
    ...overrides
  };
}

function deepeningCandidates(
  count: number,
  bucket: "likely-useful" | "maybe-useful" | "likely-noise"
) {
  return Array.from({ length: count }, (_, index) => ({
    dedupeKey: `pubmed|au|deepening|${index + 1}`,
    metadata: {
      discoveryClassification: {
        bucket
      }
    },
    triageScore: bucket === "likely-noise" ? 20 : 70
  }));
}
