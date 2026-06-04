import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimFindUnique: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  groupBy: vi.fn(),
  interventionFindUnique: vi.fn(),
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
    mocks.claimFindUnique
      .mockResolvedValueOnce({
        id: "creatine-strength",
        claimText: "Supports strength gains with resistance training.",
        outcome: "MUSCLE_STRENGTH",
        intervention: {
          id: "creatine",
          name: "Creatine monohydrate",
          synonyms: ["creatine"]
        }
      })
      .mockResolvedValue({
        interventionId: "creatine"
      });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create
      .mockResolvedValueOnce(
        dbIngestionJob({
          id: "job-pubmed-creatine-strength",
          query:
            "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review"
        })
      )
      .mockResolvedValueOnce(
        dbIngestionJob({
          id: "job-trials-creatine-strength",
          source: "CLINICALTRIALS_GOV",
          query: "Creatine monohydrate strength resistance training lean mass gains"
        })
      );

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
      region: "AU",
      trialTerm: "Creatine monohydrate strength resistance training lean mass gains",
      jobs: [
        {
          claimId: "creatine-strength",
          contextMismatchFields: [],
          created: true,
          interventionId: "creatine",
          jobId: "job-pubmed-creatine-strength",
          source: "PUBMED",
          query:
            "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review",
          region: "AU",
          status: "QUEUED"
        },
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
            name: true,
            synonyms: true
          }
        }
      }
    });
    expect(mocks.create).toHaveBeenNthCalledWith(1, {
      data: {
        source: "PUBMED",
        status: "QUEUED",
        query:
          "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review",
        region: "AU",
        interventionId: "creatine",
        claimId: "creatine-strength",
        metadata: {
          interventionId: "creatine",
          claimId: "creatine-strength"
        }
      }
    });
    expect(mocks.create).toHaveBeenNthCalledWith(2, {
      data: {
        source: "CLINICALTRIALS_GOV",
        status: "QUEUED",
        query: "Creatine monohydrate strength resistance training lean mass gains",
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

describe("runNextSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns null when there is no queued supported source-candidate job", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(runNextSourceCandidateIngestionJob({ now })).resolves.toBeNull();

    expect(mocks.findFirst).toHaveBeenCalledWith({
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
      ingestionJobId: "job-pubmed"
    });
  });

  it("does not run external ingestion when a selected next job cannot be claimed", async () => {
    mocks.findFirst.mockResolvedValueOnce(dbIngestionJob()).mockResolvedValueOnce(null);
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(runNextSourceCandidateIngestionJob({ now })).resolves.toBeNull();

    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.ingestPubMedSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.ingestClinicalTrialSourceCandidates).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
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
      retmax: undefined,
      region: "AU",
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed"
    });
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
