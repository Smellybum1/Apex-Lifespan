import { IngestionStatus, SourceKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSourceCandidateIngestionJobs,
  runNextSourceCandidateIngestionJob,
  summarizeSourceCandidateIngestionJobs
} from "@/lib/data/source-candidate-jobs";
import { listSourceCandidateIdentityGroups } from "@/lib/data/source-candidates";
import {
  planScheduledSourceIngestionDryRun,
  runScheduledSourceIngestionBatch
} from "@/lib/data/scheduled-ingestion";
import type { SourceCandidate } from "@/lib/types";

vi.mock("@/lib/data/source-candidate-jobs", () => ({
  listSourceCandidateIngestionJobs: vi.fn(),
  runNextSourceCandidateIngestionJob: vi.fn(),
  summarizeSourceCandidateIngestionJobs: vi.fn()
}));

vi.mock("@/lib/data/source-candidates", () => ({
  listSourceCandidateIdentityGroups: vi.fn()
}));

const listDuplicateIdentityGroupsMock = vi.mocked(listSourceCandidateIdentityGroups);
const listJobsMock = vi.mocked(listSourceCandidateIngestionJobs);
const runNextJobMock = vi.mocked(runNextSourceCandidateIngestionJob);
const summarizeJobsMock = vi.mocked(summarizeSourceCandidateIngestionJobs);

beforeEach(() => {
  vi.resetAllMocks();
  listDuplicateIdentityGroupsMock.mockResolvedValue([]);
});

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
        env: readySchedulerEnv(),
        maxJobsPerRun: 2
      })
    ).resolves.toEqual({
      dedupeReview: {
        duplicateIdentityGroups: 0,
        items: [],
        nextAction: "No duplicate source identities found in the bounded scheduler dedupe review."
      },
      dryRun: true,
      failureReview: {
        automaticRetries: false,
        failedJobsReviewed: 0,
        items: [],
        nextAction:
          "Review docs/codex/scheduled-ingestion-retry-policy.md, then record APEX_INGESTION_RETRY_POLICY_APPROVED_AT.",
        retryAutomationReady: false,
        retryPolicy: {
          approved: false,
          evidenceKeys: ["APEX_INGESTION_RETRY_POLICY_APPROVED_AT"],
          missingEnv: ["APEX_INGESTION_RETRY_POLICY_APPROVED_AT"],
          nextAction:
            "Review docs/codex/scheduled-ingestion-retry-policy.md, then record APEX_INGESTION_RETRY_POLICY_APPROVED_AT.",
          ready: false,
          retryMode: "manual-reviewed-retry"
        }
      },
      maxJobsPerRun: 2,
      nextAction: "Scheduled run would process 2 queued job(s).",
      noAutoPromotion: true,
      policy: {
        automaticRetries: false,
        clinicalTrialsPageSizeCap: 20,
        hostedCron: {
          approvalConfigured: true,
          databaseModeConfigured: true,
          ingestionAlertsConfigured: true,
          managedDatabaseUrlConfigured: true,
          missingEnv: [],
          ready: true,
          scheduledWritesEnabled: true
        },
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
      worksheet: {
        blocked: [
          {
            detail: "Retry policy approval is not recorded; failed jobs remain manual-review only.",
            evidenceKeys: ["APEX_INGESTION_RETRY_POLICY_APPROVED_AT"],
            id: "retry-policy",
            label: "Retry automation review",
            nextAction:
              "Review docs/codex/scheduled-ingestion-retry-policy.md, then record APEX_INGESTION_RETRY_POLICY_APPROVED_AT."
          }
        ],
        copySafeCommands: [
          {
            command: "npm run ingest:scheduled-dry-run",
            id: "scheduled-ingestion-dry-run",
            label: "Refresh scheduled ingestion dry run",
            mode: "dry-run",
            purpose:
              "Recheck queue state, hosted-cron evidence, retry policy, dedupe review, and no-auto-promotion controls without running writes."
          },
          {
            command: "npm run ingest:sources -- --db-status",
            id: "source-candidate-db-status",
            label: "Check source-candidate database",
            mode: "read-only",
            purpose: "Confirm local source-candidate storage connectivity without reading review data."
          },
          {
            command: "npm run ingest:sources -- --jobs --jobs-status queued",
            id: "queued-ingestion-jobs",
            label: "Review queued ingestion jobs",
            mode: "read-only",
            purpose: "Inspect queued source-candidate jobs before any scheduled batch is enabled."
          },
          {
            command: "npm run ingest:sources -- --jobs --jobs-status failed",
            id: "failed-ingestion-jobs",
            label: "Review failed ingestion jobs",
            mode: "read-only",
            purpose: "Inspect failed source-candidate jobs before any manual retry decision."
          },
          {
            command: "npm run ingest:sources -- --candidates --candidate-duplicates",
            id: "duplicate-source-candidates",
            label: "Review duplicate source identities",
            mode: "read-only",
            purpose: "Inspect duplicate source/external-id groups before unattended scheduled ingestion."
          },
          {
            command:
              "npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10",
            id: "candidate-review-overview",
            label: "Review pending candidate overview",
            mode: "read-only",
            purpose: "Inspect the next human review groups without changing candidate decisions."
          },
          {
            command: "npm run launch:readiness",
            id: "launch-readiness",
            label: "Refresh aggregate launch readiness",
            mode: "read-only",
            purpose: "Recheck fully-live launch gates after scheduled-ingestion evidence changes."
          }
        ],
        humanOwned: true,
        nextOperatorAction:
          "Review docs/codex/scheduled-ingestion-retry-policy.md, then record APEX_INGESTION_RETRY_POLICY_APPROVED_AT.",
        queuedWork: [
          {
            detail: "3 queued job(s); dry run would process 2.",
            id: "queued-jobs",
            label: "Queued ingestion jobs",
            nextAction: "Scheduled run would process 2 queued job(s)."
          }
        ],
        ready: [
          {
            detail: "Scheduled ingestion can report queue state without running writes.",
            id: "dry-run-support",
            label: "Dry-run support"
          },
          {
            detail: "PubMed retmax 20, ClinicalTrials.gov pageSize 20, max jobs per run 2.",
            id: "source-rate-caps",
            label: "Source rate caps"
          },
          {
            detail:
              "Scheduled ingestion keeps source candidates separate from public evidence promotion.",
            id: "no-auto-promotion",
            label: "No automatic public promotion"
          },
          {
            detail: "Failed jobs stay human-reviewed until an explicit retry policy is approved.",
            id: "automatic-retries-disabled",
            label: "Automatic retries disabled"
          },
          {
            detail: "NCBI_TOOL and NCBI_EMAIL are configured.",
            evidenceKeys: ["NCBI_TOOL", "NCBI_EMAIL"],
            id: "ncbi-metadata",
            label: "NCBI request metadata"
          },
          {
            detail:
              "Managed database mode, scheduled write gate, alerts, approval, and NCBI metadata are configured.",
            evidenceKeys: [
              "DATABASE_URL",
              "APEX_DATA_SOURCE=database",
              "APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true",
              "APEX_INGESTION_ALERTS_CONFIGURED=true",
              "APEX_SCHEDULED_INGESTION_CRON_APPROVED=true",
              "NCBI_TOOL",
              "NCBI_EMAIL"
            ],
            id: "hosted-cron",
            label: "Hosted cron evidence"
          },
          {
            detail: "No duplicate source identities found in the bounded scheduler dedupe review.",
            id: "dedupe-review",
            label: "Dedupe review"
          }
        ],
        warnings: []
      },
      wouldRunJobs: 2
    });
    expect(listDuplicateIdentityGroupsMock).toHaveBeenCalledWith({
      limit: 5
    });
  });

  it("emits only dry-run and read-only commands for scheduler handoff", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [],
      total: 0
    });
    listJobsMock.mockResolvedValue([]);

    const plan = await planScheduledSourceIngestionDryRun();

    expect(plan.worksheet.copySafeCommands).toHaveLength(7);
    expect(plan.worksheet.copySafeCommands.map((item) => item.mode)).toEqual([
      "dry-run",
      "read-only",
      "read-only",
      "read-only",
      "read-only",
      "read-only",
      "read-only"
    ]);
    expect(plan.worksheet.copySafeCommands.some((item) => item.command.includes("--apply"))).toBe(
      false
    );
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
        hostedCron: {
          approvalConfigured: false,
          databaseModeConfigured: false,
          ingestionAlertsConfigured: false,
          managedDatabaseUrlConfigured: false,
          missingEnv: [
            "DATABASE_URL",
            "APEX_DATA_SOURCE=database",
            "APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true",
            "APEX_INGESTION_ALERTS_CONFIGURED=true",
            "APEX_SCHEDULED_INGESTION_CRON_APPROVED=true",
            "NCBI_TOOL",
            "NCBI_EMAIL"
          ],
          ready: false,
          scheduledWritesEnabled: false
        },
        hostedCronReady: false,
        missingMetadata: ["NCBI_TOOL", "NCBI_EMAIL"],
        ncbiMetadataConfigured: false,
        noAutoPromotion: true,
        pubMedRetmaxCap: 20,
        schedulerDefaultJobsPerRun: 1,
        schedulerMaxJobsPerRun: 5,
        sourcePolicy: "review-before-enable"
      },
      worksheet: {
        blocked: expect.arrayContaining([
          expect.objectContaining({
            evidenceKeys: ["NCBI_TOOL", "NCBI_EMAIL"],
            id: "ncbi-metadata",
            nextAction:
              "Configure missing NCBI metadata before unattended PubMed ingestion: NCBI_TOOL, NCBI_EMAIL."
          }),
          expect.objectContaining({
            evidenceKeys: [
              "DATABASE_URL",
              "APEX_DATA_SOURCE=database",
              "APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true",
              "APEX_INGESTION_ALERTS_CONFIGURED=true",
              "APEX_SCHEDULED_INGESTION_CRON_APPROVED=true",
              "NCBI_TOOL",
              "NCBI_EMAIL"
            ],
            id: "hosted-cron"
          }),
          expect.objectContaining({
            id: "retry-policy"
          })
        ]),
        humanOwned: true,
        nextOperatorAction:
          "Configure missing NCBI metadata before unattended PubMed ingestion: NCBI_TOOL, NCBI_EMAIL."
      },
      wouldRunJobs: 0
    });
  });

  it("keeps hosted cron blocked for local database URLs and missing launch evidence", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [],
      total: 0
    });
    listJobsMock.mockResolvedValue([]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: {
          APEX_DATA_SOURCE: "database",
          APEX_SCHEDULED_INGESTION_WRITES_ENABLED: "true",
          DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/apex_lifespan",
          NCBI_EMAIL: "operator@example.com",
          NCBI_TOOL: "apex-lifespan"
        }
      })
    ).resolves.toMatchObject({
      policy: {
        hostedCron: {
          approvalConfigured: false,
          databaseModeConfigured: true,
          ingestionAlertsConfigured: false,
          managedDatabaseUrlConfigured: false,
          missingEnv: [
            "DATABASE_URL",
            "APEX_INGESTION_ALERTS_CONFIGURED=true",
            "APEX_SCHEDULED_INGESTION_CRON_APPROVED=true"
          ],
          ready: false,
          scheduledWritesEnabled: true
        },
        hostedCronReady: false,
        ncbiMetadataConfigured: true
      }
    });
  });

  it("summarizes failed jobs for manual retry review without exposing raw errors", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [
        {
          count: 2,
          region: "AU",
          source: SourceKind.PUBMED,
          status: IngestionStatus.FAILED
        }
      ],
      total: 2
    });
    listJobsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        failedJob("failed-config", "Environment variable not found: NCBI_EMAIL=private@example.com"),
        failedJob("failed-upstream", "NCBI unavailable with token secret-123")
      ]);

    const review = await planScheduledSourceIngestionDryRun({
      env: readySchedulerEnv()
    });

    expect(review).toMatchObject({
      failureReview: {
        automaticRetries: false,
        failedJobsReviewed: 2,
        items: [
          {
            category: "missing-configuration",
            jobId: "failed-config",
            nextAction: "Fix missing configuration, then rerun a dry-run before any manual retry.",
            region: "AU",
            retryDisposition: "fix-configuration-first",
            source: SourceKind.PUBMED
          },
          {
            category: "upstream-unavailable",
            jobId: "failed-upstream",
            nextAction: "Confirm the upstream is healthy before any manual retry.",
            region: "AU",
            retryDisposition: "wait-for-upstream-and-review",
            source: SourceKind.PUBMED
          }
        ],
        nextAction:
          "Review failed ingestion jobs and their categories before enabling any retry automation.",
        retryAutomationReady: false,
        retryPolicy: {
          approved: false,
          missingEnv: ["APEX_INGESTION_RETRY_POLICY_APPROVED_AT"],
          ready: false,
          retryMode: "manual-reviewed-retry"
        }
      },
      nextAction: "Review failed ingestion jobs before queueing more scheduled work.",
      recentFailures: 2,
      worksheet: {
        warnings: [
          {
            detail: "2 recent failed ingestion job(s) need manual retry review.",
            id: "recent-failures",
            label: "Recent failed jobs",
            nextAction:
              "Review failed ingestion jobs and their categories before enabling any retry automation."
          }
        ]
      }
    });
    expect(JSON.stringify(review.failureReview)).not.toContain("secret-123");
    expect(JSON.stringify(review.failureReview)).not.toContain("private@example.com");
  });

  it("marks retry policy ready only after approval and no recent failures", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [],
      total: 0
    });
    listJobsMock.mockResolvedValue([]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: approvedRetrySchedulerEnv()
      })
    ).resolves.toMatchObject({
      failureReview: {
        failedJobsReviewed: 0,
        nextAction:
          "Retry policy evidence is approved; keep automatic retries disabled until launch approval.",
        retryAutomationReady: true,
        retryPolicy: {
          approved: true,
          missingEnv: [],
          ready: true,
          retryMode: "manual-reviewed-retry"
        }
      },
      worksheet: {
        blocked: [],
        ready: expect.arrayContaining([
          {
            detail:
              "Retry policy approval is recorded and there are no recent failed jobs awaiting manual review.",
            evidenceKeys: ["APEX_INGESTION_RETRY_POLICY_APPROVED_AT"],
            id: "retry-policy",
            label: "Retry policy evidence"
          }
        ])
      }
    });
  });

  it("keeps retry policy blocked when recent failures need review even after approval", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [
        {
          count: 1,
          region: "AU",
          source: SourceKind.PUBMED,
          status: IngestionStatus.FAILED
        }
      ],
      total: 1
    });
    listJobsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([failedJob("failed-upstream", "NCBI unavailable")]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: approvedRetrySchedulerEnv()
      })
    ).resolves.toMatchObject({
      failureReview: {
        failedJobsReviewed: 1,
        retryAutomationReady: false,
        retryPolicy: {
          approved: true,
          ready: true
        }
      },
      worksheet: {
        blocked: expect.arrayContaining([
          expect.objectContaining({
            detail: "Recent failed jobs must be manually reviewed before retry automation is launch-ready.",
            evidenceKeys: [],
            id: "retry-policy"
          })
        ]),
        warnings: expect.arrayContaining([
          expect.objectContaining({
            id: "recent-failures"
          })
        ])
      }
    });
  });

  it("summarizes duplicate source identities for human dedupe review", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [],
      total: 0
    });
    listJobsMock.mockResolvedValue([]);
    listDuplicateIdentityGroupsMock.mockResolvedValue([
      {
        externalId: "42141930",
        source: "PubMed",
        candidates: [
          sourceCandidate({
            dedupeKey: "pubmed|au|creatine-meta|42141930||",
            decision: "Pending review"
          }),
          sourceCandidate({
            dedupeKey: "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
            decision: "Accepted"
          })
        ]
      }
    ]);

    await expect(
      planScheduledSourceIngestionDryRun({
        env: readySchedulerEnv()
      })
    ).resolves.toMatchObject({
      dedupeReview: {
        duplicateIdentityGroups: 1,
        items: [
          {
            acceptedCandidates: 1,
            candidateCount: 2,
            externalId: "42141930",
            mixedDecision: true,
            nextAction:
              "Compare accepted, rejected, and pending rows before any scheduled retry or review action.",
            pendingCandidates: 1,
            rejectedCandidates: 0,
            reviewCommand:
              "npm run ingest:sources -- --candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 42141930",
            source: "PubMed"
          }
        ],
        nextAction:
          "Review duplicate source identities before enabling unattended scheduled ingestion."
      },
      worksheet: {
        warnings: [
          {
            detail:
              "1 duplicate source identity group(s) need human review before unattended scheduled ingestion.",
            id: "duplicate-source-identities",
            label: "Duplicate source identities",
            nextAction:
              "Review duplicate source identities before enabling unattended scheduled ingestion."
          }
        ]
      }
    });
  });
});

describe("scheduled source ingestion batch runner", () => {
  it("defaults to dry-run and does not run queued jobs", async () => {
    mockQueuedSchedulerState(2);

    await expect(
      runScheduledSourceIngestionBatch({
        env: readySchedulerEnv(),
        maxJobsPerRun: 2
      })
    ).resolves.toMatchObject({
      applied: false,
      blocked: false,
      dryRun: true,
      executedJobs: [],
      noAutoPromotion: true
    });
    expect(runNextJobMock).not.toHaveBeenCalled();
  });

  it("blocks apply mode unless the scheduled-ingestion write gate is enabled", async () => {
    mockQueuedSchedulerState(1);

    await expect(
      runScheduledSourceIngestionBatch({
        apply: true,
        env: {
          NCBI_EMAIL: "operator@example.com",
          NCBI_TOOL: "apex-lifespan"
        }
      })
    ).resolves.toMatchObject({
      applied: false,
      blocked: true,
      dryRun: true,
      executedJobs: [],
      nextAction: "APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true is required when --apply is used."
    });
    expect(runNextJobMock).not.toHaveBeenCalled();
  });

  it("blocks apply mode until NCBI metadata is configured", async () => {
    mockQueuedSchedulerState(1);

    await expect(
      runScheduledSourceIngestionBatch({
        apply: true,
        env: {
          APEX_SCHEDULED_INGESTION_WRITES_ENABLED: "true"
        }
      })
    ).resolves.toMatchObject({
      applied: false,
      blocked: true,
      dryRun: true,
      nextAction: "NCBI metadata is required when --apply is used: NCBI_TOOL, NCBI_EMAIL."
    });
    expect(runNextJobMock).not.toHaveBeenCalled();
  });

  it("runs a bounded batch with source caps and no automatic promotion", async () => {
    mockQueuedSchedulerState(3);
    runNextJobMock
      .mockResolvedValueOnce(runResult("job-1"))
      .mockResolvedValueOnce(runResult("job-2"));

    await expect(
      runScheduledSourceIngestionBatch({
        apply: true,
        env: readySchedulerEnv(),
        maxJobsPerRun: 2
      })
    ).resolves.toMatchObject({
      applied: true,
      automaticRetries: false,
      blocked: false,
      dryRun: false,
      executedJobs: [{ jobId: "job-1" }, { jobId: "job-2" }],
      nextAction: "Scheduled run processed 2 queued job(s).",
      noAutoPromotion: true
    });
    expect(runNextJobMock).toHaveBeenCalledTimes(2);
    expect(runNextJobMock).toHaveBeenCalledWith({
      clinicalTrialPageSize: 20,
      pubMedRetmax: 20
    });
  });

  it("does not apply while another scheduled job is running", async () => {
    summarizeJobsMock.mockResolvedValue({
      groups: [
        {
          count: 1,
          region: "AU",
          source: SourceKind.PUBMED,
          status: IngestionStatus.RUNNING
        }
      ],
      total: 1
    });
    listJobsMock
      .mockResolvedValueOnce([queuedJob("running-job")])
      .mockResolvedValueOnce([queuedJob("queued-job")])
      .mockResolvedValueOnce([]);

    await expect(
      runScheduledSourceIngestionBatch({
        apply: true,
        env: readySchedulerEnv()
      })
    ).resolves.toMatchObject({
      applied: false,
      blocked: true,
      dryRun: true,
      nextAction: "Wait for running ingestion jobs before starting another scheduled batch."
    });
    expect(runNextJobMock).not.toHaveBeenCalled();
  });
});

function mockQueuedSchedulerState(queuedCount: number) {
  summarizeJobsMock.mockResolvedValue({
    groups: [
      {
        count: queuedCount,
        region: "AU",
        source: SourceKind.PUBMED,
        status: IngestionStatus.QUEUED
      }
    ],
    total: queuedCount
  });
  listJobsMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(
      Array.from({ length: queuedCount }, (_, index) => queuedJob(`job-${index + 1}`))
    )
    .mockResolvedValueOnce([]);
}

function readySchedulerEnv() {
  return {
    APEX_DATA_SOURCE: "database",
    APEX_INGESTION_ALERTS_CONFIGURED: "true",
    APEX_SCHEDULED_INGESTION_CRON_APPROVED: "true",
    APEX_SCHEDULED_INGESTION_WRITES_ENABLED: "true",
    DATABASE_URL: "postgresql://user:password@db.example.com/apex",
    NCBI_EMAIL: "operator@example.com",
    NCBI_TOOL: "apex-lifespan"
  };
}

function approvedRetrySchedulerEnv() {
  return {
    ...readySchedulerEnv(),
    APEX_INGESTION_RETRY_POLICY_APPROVED_AT: "2026-06-11T15:00:00Z"
  };
}

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

function failedJob(jobId: string, error: string) {
  return {
    ...queuedJob(jobId),
    error,
    status: IngestionStatus.FAILED
  };
}

function runResult(jobId: string) {
  return {
    error: undefined,
    jobId,
    query: "creatine",
    recordsChanged: 1,
    recordsFound: 1,
    region: "AU",
    source: SourceKind.PUBMED,
    status: IngestionStatus.SUCCEEDED
  };
}

function sourceCandidate(overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return {
    abstractAvailable: true,
    decision: "Pending review",
    dedupeKey: "pubmed|au|creatine|42141930|creatine|creatine-strength",
    externalId: "42141930",
    metadata: {},
    publishedYear: 2026,
    query: "creatine",
    region: "AU",
    reviewStatus: "Unreviewed AI draft",
    source: "PubMed",
    sourceType: "Review",
    title: "Creatine trial",
    triageReasons: ["Title matches query"],
    triageScore: 80,
    url: "https://pubmed.ncbi.nlm.nih.gov/42141930/",
    ...overrides
  };
}
