import { IngestionStatus, SourceKind } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  listSourceCandidateIngestionJobs,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";
import { planScheduledSourceIngestionDryRun } from "@/lib/data/scheduled-ingestion";

vi.mock("@/lib/data/source-candidate-jobs", () => ({
  listSourceCandidateIngestionJobs: vi.fn(),
  summarizeSourceCandidateIngestionJobs: vi.fn()
}));

const listJobsMock = vi.mocked(listSourceCandidateIngestionJobs);
const summarizeJobsMock = vi.mocked(summarizeSourceCandidateIngestionJobs);

describe("scheduled source ingestion dry run", () => {
  it("plans a bounded queued-job batch without promotion", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [
        {
          count: 3,
          region: "AU",
          source: SourceKind.PUBMED,
          status: IngestionStatus.QUEUED
        }
      ],
      total: 3
    });
    listJobsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        queuedJob("job-1"),
        queuedJob("job-2"),
        queuedJob("job-3")
      ])
      .mockResolvedValueOnce([]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: {
          NCBI_EMAIL: "operator@example.com",
          NCBI_TOOL: "apex-lifespan"
        },
        maxJobsPerRun: 2
      })
    ).resolves.toEqual({
      dryRun: true,
      maxJobsPerRun: 2,
      nextAction: "Scheduled run would process 2 queued job(s).",
      noAutoPromotion: true,
      policy: {
        automaticRetries: false,
        clinicalTrialsPageSizeCap: 20,
        hostedCronReady: true,
        missingMetadata: [],
        ncbiMetadataConfigured: true,
        noAutoPromotion: true,
        pubMedRetmaxCap: 20,
        schedulerDefaultJobsPerRun: 1,
        schedulerMaxJobsPerRun: 5,
        sourcePolicy: "review-before-enable"
      },
      queuedJobs: 3,
      recentFailures: 0,
      runningJobs: 0,
      wouldRunJobs: 2
    });
  });

  it("does not plan new work while jobs are running", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [
        {
          count: 1,
          region: "AU",
          source: SourceKind.CLINICALTRIALS_GOV,
          status: IngestionStatus.RUNNING
        }
      ],
      total: 1
    });
    listJobsMock
      .mockResolvedValueOnce([queuedJob("running-job")])
      .mockResolvedValueOnce([queuedJob("queued-job")])
      .mockResolvedValueOnce([]);

    await expect(planScheduledSourceIngestionDryRun()).resolves.toMatchObject({
      nextAction: "Wait for running ingestion jobs before starting another scheduled batch.",
      runningJobs: 1,
      wouldRunJobs: 0
    });
  });

  it("reports source policy and missing metadata without running jobs", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [],
      total: 0
    });
    listJobsMock.mockResolvedValue([]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: {},
        maxJobsPerRun: 200
      })
    ).resolves.toMatchObject({
      dryRun: true,
      maxJobsPerRun: 5,
      noAutoPromotion: true,
      policy: {
        automaticRetries: false,
        clinicalTrialsPageSizeCap: 20,
        hostedCronReady: false,
        missingMetadata: ["NCBI_TOOL", "NCBI_EMAIL"],
        ncbiMetadataConfigured: false,
        noAutoPromotion: true,
        pubMedRetmaxCap: 20,
        schedulerDefaultJobsPerRun: 1,
        schedulerMaxJobsPerRun: 5,
        sourcePolicy: "review-before-enable"
      },
      wouldRunJobs: 0
    });
  });
});

function queuedJob(jobId: string) {
  return {
    createdAt: "2026-06-11T00:00:00.000Z",
    jobId,
    query: "creatine",
    recordsChanged: 0,
    recordsFound: 0,
    region: "AU",
    source: SourceKind.PUBMED,
    status: IngestionStatus.QUEUED,
    updatedAt: "2026-06-11T00:00:00.000Z"
  };
}
