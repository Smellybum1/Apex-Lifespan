import { describe, expect, it, vi } from "vitest";

import {
  commandUsage,
  parseSourceCandidateJobCommandArgs,
  runSourceCandidateJobCommand
} from "@/lib/data/source-candidate-job-command";

describe("parseSourceCandidateJobCommandArgs", () => {
  it("uses bounded defaults for the local ingestion command", () => {
    expect(parseSourceCandidateJobCommandArgs([])).toEqual({
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses job, batch, and source-specific limits", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--limit",
        "99",
        "--pubmed-retmax",
        "50",
        "--clinical-trial-page-size",
        "3"
      ])
    ).toEqual({
      help: false,
      limit: 25,
      summary: false,
      pubMedRetmax: 20,
      clinicalTrialPageSize: 3
    });

    expect(parseSourceCandidateJobCommandArgs(["--job-id", "job-pubmed"])).toEqual({
      help: false,
      jobId: "job-pubmed",
      limit: 1,
      summary: false
    });
  });

  it("parses read-only summary mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--summary"])).toEqual({
      help: false,
      limit: 1,
      summary: true
    });
  });

  it("parses read-only candidate review queue mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--candidates"])).toEqual({
      candidates: true,
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidates-limit",
        "200",
        "--candidate-source",
        "clinical-trials"
      ])
    ).toEqual({
      candidates: true,
      candidatesLimit: 50,
      candidateSource: "ClinicalTrials.gov",
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only recent job mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--jobs"])).toEqual({
      help: false,
      jobs: true,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-limit", "200"])
    ).toEqual({
      help: false,
      jobs: true,
      jobsLimit: 50,
      limit: 1,
      summary: false
    });
  });

  it("parses queue mode and queue metadata", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--queue-pubmed",
        "creatine strength",
        "--region",
        "au",
        "--intervention-id",
        "creatine",
        "--claim-id",
        "creatine-strength"
      ])
    ).toEqual({
      help: false,
      limit: 1,
      queueSource: "PubMed",
      queueQuery: "creatine strength",
      region: "au",
      interventionId: "creatine",
      claimId: "creatine-strength",
      summary: false
    });

    expect(
      parseSourceCandidateJobCommandArgs([
        "--queue-clinical-trials",
        "creatine aging"
      ])
    ).toEqual({
      help: false,
      limit: 1,
      queueSource: "ClinicalTrials.gov",
      queueQuery: "creatine aging",
      summary: false
    });
  });

  it("fails closed on unknown options and invalid numbers", () => {
    expect(() => parseSourceCandidateJobCommandArgs(["--wat"])).toThrow(
      "Unknown option: --wat"
    );
    expect(() => parseSourceCandidateJobCommandArgs(["--limit", "0"])).toThrow(
      "--limit must be a positive integer."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--pubmed-retmax", "two"])
    ).toThrow("--pubmed-retmax must be a positive integer.");
  });

  it("does not combine specific-job mode with batch mode", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--job-id", "job-pubmed", "--limit", "2"])
    ).toThrow("--job-id runs exactly one job and cannot be combined with --limit.");
  });

  it("does not combine read-only summary mode with run options", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--summary", "--limit", "2"])
    ).toThrow("--summary is read-only and cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--summary", "--job-id", "job-pubmed"])
    ).toThrow("--summary is read-only and cannot be combined with run options.");
  });

  it("does not combine candidate review queue mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates-limit", "2"])
    ).toThrow("--candidates-limit and --candidate-source require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-source", "pubmed"])
    ).toThrow("--candidates-limit and --candidate-source require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--summary"])
    ).toThrow("--candidates cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--jobs"])
    ).toThrow("--candidates cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--queue-pubmed", "creatine"])
    ).toThrow("--candidates is read-only and cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--limit", "2"])
    ).toThrow("--candidates is read-only and cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--pubmed-retmax", "5"])
    ).toThrow("--candidates is read-only and cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates", "--candidate-source", "other"])
    ).toThrow("--candidate-source must be pubmed or clinical-trials.");
  });

  it("does not combine queue mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--queue-pubmed",
        "creatine",
        "--queue-clinical-trials",
        "creatine"
      ])
    ).toThrow("Only one queue option can be used at a time.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--queue-pubmed", "creatine", "--limit", "2"])
    ).toThrow("Queue options cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--queue-pubmed", "creatine", "--summary"])
    ).toThrow("--summary is read-only and cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--region", "AU"])
    ).toThrow("--region, --intervention-id, and --claim-id require a queue option.");
  });

  it("does not combine recent job mode with other command modes", () => {
    expect(() => parseSourceCandidateJobCommandArgs(["--jobs-limit", "2"])).toThrow(
      "--jobs-limit requires --jobs."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--summary"])
    ).toThrow("--jobs cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--queue-pubmed", "creatine"])
    ).toThrow("--jobs is read-only and cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--limit", "2"])
    ).toThrow("--jobs is read-only and cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--pubmed-retmax", "5"])
    ).toThrow("--jobs is read-only and cannot be combined with run options.");
  });
});

describe("runSourceCandidateJobCommand", () => {
  it("prints usage without running jobs", async () => {
    const stdout = vi.fn();
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(["--help"], { stdout }, { runNextJob })
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(commandUsage());
    expect(runNextJob).not.toHaveBeenCalled();
  });

  it("prints read-only backlog summary without running jobs", async () => {
    const stdout = vi.fn();
    const runNextJob = vi.fn();
    const summarizeBacklog = vi.fn().mockResolvedValue({
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

    await expect(
      runSourceCandidateJobCommand(
        ["--summary"],
        { stdout },
        { runNextJob, summarizeBacklog }
      )
    ).resolves.toBe(0);

    expect(runNextJob).not.toHaveBeenCalled();
    expect(summarizeBacklog).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate backlog: total=4",
        "- PubMed AU Pending review / Unreviewed AI draft: 3",
        "- ClinicalTrials.gov AU Accepted / Human reviewed: 1"
      ].join("\n")
    );
  });

  it("prints read-only source-candidate review queue rows without running jobs", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([
      sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        source: "PubMed",
        region: "AU",
        title: "Creatine position stand",
        triageScore: 80,
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }),
      sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov",
        region: "AU",
        title: "Creatine and aging",
        triageScore: 70,
        url: "https://clinicaltrials.gov/study/NCT123"
      })
    ]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidates",
          "--candidates-limit",
          "2",
          "--candidate-source",
          "pubmed"
        ],
        { stdout },
        { listCandidates, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      limit: 2,
      source: "PubMed"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review queue: total=2",
        '- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996|creatine|creatine-strength" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ intervention=creatine claim=creatine-strength',
        '- triage=70/100 ClinicalTrials.gov AU dedupe="clinicaltrials.gov|au|creatine|nct123" title="Creatine and aging" url=https://clinicaltrials.gov/study/NCT123'
      ].join("\n")
    );
  });

  it("prints an empty source-candidate review queue", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([]);

    await expect(
      runSourceCandidateJobCommand(["--candidates"], { stdout }, { listCandidates })
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith("Source-candidate review queue: total=0");
  });

  it("prints read-only recent ingestion jobs without running jobs", async () => {
    const stdout = vi.fn();
    const listJobs = vi.fn().mockResolvedValue([
      {
        jobId: "job-pubmed",
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        status: "SUCCEEDED",
        recordsFound: 5,
        recordsChanged: 3,
        updatedAt: "2026-06-02T01:02:00.000Z",
        createdAt: "2026-06-02T00:00:00.000Z",
        completedAt: "2026-06-02T01:02:00.000Z",
        startedAt: "2026-06-02T01:00:00.000Z"
      },
      {
        jobId: "job-trials",
        source: "CLINICALTRIALS_GOV",
        query: "creatine aging",
        region: "AU",
        status: "FAILED",
        recordsFound: 0,
        recordsChanged: 0,
        updatedAt: "2026-06-02T02:01:00.000Z",
        createdAt: "2026-06-02T02:00:00.000Z",
        error: "ClinicalTrials unavailable"
      }
    ]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--jobs", "--jobs-limit", "2"],
        { stdout },
        { listJobs, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listJobs).toHaveBeenCalledWith({
      limit: 2
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate ingestion jobs: total=2",
        '- [SUCCEEDED] job-pubmed PUBMED AU "creatine strength" found=5 changed=3 updated=2026-06-02T01:02:00.000Z',
        '- [FAILED] job-trials CLINICALTRIALS_GOV AU "creatine aging" found=0 changed=0 updated=2026-06-02T02:01:00.000Z error=ClinicalTrials unavailable'
      ].join("\n")
    );
  });

  it("prints an empty recent job list", async () => {
    const stdout = vi.fn();
    const listJobs = vi.fn().mockResolvedValue([]);

    await expect(
      runSourceCandidateJobCommand(["--jobs"], { stdout }, { listJobs })
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith("Source-candidate ingestion jobs: total=0");
  });

  it("queues a source-candidate ingestion job without running jobs", async () => {
    const stdout = vi.fn();
    const queueJob = vi.fn().mockResolvedValue({
      created: true,
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "QUEUED"
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--queue-pubmed",
          "creatine strength",
          "--region",
          "au",
          "--intervention-id",
          "creatine",
          "--claim-id",
          "creatine-strength"
        ],
        { stdout },
        { queueJob, runNextJob }
      )
    ).resolves.toBe(0);

    expect(queueJob).toHaveBeenCalledWith({
      source: "PubMed",
      query: "creatine strength",
      region: "au",
      interventionId: "creatine",
      claimId: "creatine-strength"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[QUEUED] job-pubmed PUBMED AU "creatine strength" created=true'
    );
  });

  it("reports existing queued jobs without claiming them", async () => {
    const stdout = vi.fn();
    const queueJob = vi.fn().mockResolvedValue({
      created: false,
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });
    const runJobById = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--queue-pubmed", "creatine strength"],
        { stdout },
        { queueJob, runJobById }
      )
    ).resolves.toBe(0);

    expect(runJobById).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[SUCCEEDED] job-pubmed PUBMED AU "creatine strength" created=false'
    );
  });

  it("returns a failing exit code when queueing fails", async () => {
    const stderr = vi.fn();
    const queueJob = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(
      runSourceCandidateJobCommand(
        ["--queue-pubmed", "creatine strength"],
        { stderr },
        { queueJob }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith("database unavailable");
  });

  it("prints an empty backlog summary", async () => {
    const stdout = vi.fn();
    const summarizeBacklog = vi.fn().mockResolvedValue({
      total: 0,
      groups: []
    });

    await expect(
      runSourceCandidateJobCommand(["--summary"], { stdout }, { summarizeBacklog })
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith("Source-candidate backlog: total=0");
  });

  it("runs one queued job by default", async () => {
    const stdout = vi.fn();
    const runNextJob = vi
      .fn()
      .mockResolvedValueOnce(jobResult({ jobId: "job-pubmed" }));

    await expect(
      runSourceCandidateJobCommand([], { stdout }, { runNextJob })
    ).resolves.toBe(0);

    expect(runNextJob).toHaveBeenCalledTimes(1);
    expect(runNextJob).toHaveBeenCalledWith({
      clinicalTrialPageSize: undefined,
      pubMedRetmax: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      '[SUCCEEDED] job-pubmed PUBMED AU "creatine strength" found=1 changed=1'
    );
  });

  it("runs queued jobs up to the requested limit and stops when the queue is empty", async () => {
    const stdout = vi.fn();
    const runNextJob = vi
      .fn()
      .mockResolvedValueOnce(jobResult({ jobId: "job-1" }))
      .mockResolvedValueOnce(jobResult({ jobId: "job-2", recordsChanged: 0 }))
      .mockResolvedValueOnce(null);

    await expect(
      runSourceCandidateJobCommand(
        ["--limit", "5", "--pubmed-retmax", "3"],
        { stdout },
        { runNextJob }
      )
    ).resolves.toBe(0);

    expect(runNextJob).toHaveBeenCalledTimes(3);
    expect(runNextJob).toHaveBeenCalledWith({
      clinicalTrialPageSize: undefined,
      pubMedRetmax: 3
    });
    expect(stdout).toHaveBeenCalledTimes(2);
  });

  it("runs a specific job id exactly once", async () => {
    const stdout = vi.fn();
    const runJobById = vi.fn().mockResolvedValue(jobResult({ jobId: "job-target" }));
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--job-id", "job-target", "--clinical-trial-page-size", "4"],
        { stdout },
        { runJobById, runNextJob }
      )
    ).resolves.toBe(0);

    expect(runJobById).toHaveBeenCalledWith("job-target", {
      clinicalTrialPageSize: 4,
      pubMedRetmax: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[SUCCEEDED] job-target PUBMED AU "creatine strength" found=1 changed=1'
    );
  });

  it("prints an empty-queue message when no queued jobs exist", async () => {
    const stdout = vi.fn();
    const runNextJob = vi.fn().mockResolvedValue(null);

    await expect(
      runSourceCandidateJobCommand([], { stdout }, { runNextJob })
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      "No queued PubMed or ClinicalTrials.gov source-candidate jobs found."
    );
  });

  it("returns a failing exit code when any job fails", async () => {
    const stdout = vi.fn();
    const runNextJob = vi.fn().mockResolvedValue(
      jobResult({
        status: "FAILED",
        recordsFound: 0,
        recordsChanged: 0,
        error: "NCBI unavailable"
      })
    );

    await expect(
      runSourceCandidateJobCommand([], { stdout }, { runNextJob })
    ).resolves.toBe(1);

    expect(stdout).toHaveBeenCalledWith(
      '[FAILED] job-pubmed PUBMED AU "creatine strength" found=0 changed=0 error=NCBI unavailable'
    );
  });

  it("prints parse errors to stderr with usage", async () => {
    const stderr = vi.fn();

    await expect(
      runSourceCandidateJobCommand(["--limit", "nope"], { stderr })
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenNthCalledWith(
      1,
      "--limit must be a positive integer."
    );
    expect(stderr).toHaveBeenNthCalledWith(2, commandUsage());
  });
});

function jobResult(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "job-pubmed",
    source: "PUBMED",
    query: "creatine strength",
    region: "AU",
    status: "SUCCEEDED",
    recordsFound: 1,
    recordsChanged: 1,
    error: undefined,
    ...overrides
  };
}

function sourceCandidate(overrides: Record<string, unknown> = {}) {
  return {
    dedupeKey: "pubmed|au|creatine|28615996",
    source: "PubMed",
    externalId: "28615996",
    query: "creatine strength",
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
    metadata: {},
    ...overrides
  };
}
