import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  ingestClinicalTrialSourceCandidates: vi.fn(),
  ingestPubMedSourceCandidates: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ingestionJob: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      update: mocks.update
    }
  }
}));

vi.mock("@/lib/data/source-candidate-ingestion", () => ({
  ingestClinicalTrialSourceCandidates: mocks.ingestClinicalTrialSourceCandidates,
  ingestPubMedSourceCandidates: mocks.ingestPubMedSourceCandidates
}));

import {
  runNextSourceCandidateIngestionJob,
  runSourceCandidateIngestionJob
} from "@/lib/data/source-candidate-jobs";

const timestamp = new Date("2026-06-02T03:00:00.000Z");
const now = () => timestamp;

describe("runNextSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("runs the oldest queued supported job", async () => {
    mocks.findFirst.mockResolvedValue(dbIngestionJob());
    mocks.findUnique.mockResolvedValue(dbIngestionJob());
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

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: "job-pubmed"
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
});

describe("runSourceCandidateIngestionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "job-pubmed"
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
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
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
  });
});

function dbIngestionJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-pubmed",
    source: "PUBMED",
    status: "QUEUED",
    query: "creatine strength",
    region: "AU",
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
