import { describe, expect, it } from "vitest";

import { parseSourceCandidateJobCommandArgs } from "@/lib/data/source-candidate-job-command";

describe("parseSourceCandidateJobCommandArgs", () => {
  it("uses a read-only summary default for the local ingestion command", () => {
    expect(parseSourceCandidateJobCommandArgs([])).toEqual({
      help: false,
      limit: 1,
      summary: true
    });
  });

  it("parses explicit job, batch, and source-specific run limits", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--run-next",
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
      runNextJobs: true,
      pubMedRetmax: 20,
      clinicalTrialPageSize: 3
    });

    expect(parseSourceCandidateJobCommandArgs(["--job-id", "job-pubmed"])).toEqual({
      help: false,
      jobId: "job-pubmed",
      limit: 1,
      summary: false
    });

    expect(() => parseSourceCandidateJobCommandArgs(["--limit", "2"])).toThrow(
      "--limit requires --run-next."
    );

    expect(() =>
      parseSourceCandidateJobCommandArgs(["--pubmed-retmax", "3"])
    ).toThrow(
      "--pubmed-retmax and --clinical-trial-page-size require --run-next or --job-id."
    );

    expect(() =>
      parseSourceCandidateJobCommandArgs(["--run-next", "--job-id", "job-pubmed"])
    ).toThrow("--run-next cannot be combined with --job-id.");
  });

  it("parses rate-limited watch mode for background local ingestion", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--run-next",
        "--watch",
        "--limit",
        "2",
        "--watch-interval-ms",
        "50",
        "--watch-idle-exit",
        "3"
      ])
    ).toEqual({
      help: false,
      limit: 2,
      summary: false,
      runNextJobs: true,
      watch: true,
      watchIntervalMs: 1000,
      watchIdleExit: 3
    });

    expect(() => parseSourceCandidateJobCommandArgs(["--watch"])).toThrow(
      "--watch requires --run-next."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--run-next", "--watch-interval-ms", "1000"])
    ).toThrow("--watch-interval-ms requires --watch.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--run-next", "--watch-idle-exit", "1"])
    ).toThrow("--watch-idle-exit requires --watch.");
  });

  it("parses read-only summary mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--summary"])).toEqual({
      help: false,
      limit: 1,
      summary: true
    });
  });

  it("parses read-only database status mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--db-status"])).toEqual({
      dbStatus: true,
      help: false,
      limit: 1,
      summary: false
    });
  });
});
