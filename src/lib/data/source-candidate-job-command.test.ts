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
