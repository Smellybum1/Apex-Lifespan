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

  it("parses read-only source-candidate detail mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toEqual({
      candidateDetailDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only source-candidate reference match mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toEqual({
      candidateReferenceMatchesDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only source-candidate curation status mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996"
      ])
    ).toEqual({
      candidateCurationStatusDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses source-candidate review modes", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        "Full-text reviewed."
      ])
    ).toEqual({
      acceptedReferenceId: "ref-creatine-position-stand",
      help: false,
      limit: 1,
      reviewCandidateDedupeKey: "pubmed|au|creatine|28615996",
      reviewDecision: "Accepted",
      reviewNote: "Full-text reviewed.",
      summary: false
    });

    expect(
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "clinicaltrials.gov|au|creatine|nct123",
        "--review-note",
        "Not relevant to the consumer claim."
      ])
    ).toEqual({
      help: false,
      limit: 1,
      reviewCandidateDedupeKey: "clinicaltrials.gov|au|creatine|nct123",
      reviewDecision: "Rejected",
      reviewNote: "Not relevant to the consumer claim.",
      summary: false
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
        "clinical-trials",
        "--candidate-decision",
        "accepted",
        "--candidate-job-id",
        "job-pubmed",
        "--candidate-intervention-id",
        "creatine",
        "--candidate-claim-id",
        "creatine-strength"
      ])
    ).toEqual({
      candidates: true,
      candidateClaimId: "creatine-strength",
      candidateDecision: "Accepted",
      candidateInterventionId: "creatine",
      candidateJobId: "job-pubmed",
      candidatesLimit: 50,
      candidateSource: "ClinicalTrials.gov",
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidate-decision",
        "pending-review"
      ])
    ).toEqual({
      candidates: true,
      candidateDecision: "Pending review",
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

  it("does not combine source-candidate detail mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--candidate-detail cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-detail cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow("Candidate-list filters cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--candidate-job-id",
        "job-pubmed"
      ])
    ).toThrow("Candidate-list filters cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-detail cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-detail cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-detail cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow("--candidate-detail cannot be combined with queue metadata.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-detail",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-detail cannot be combined with run options.");
  });

  it("does not combine source-candidate curation status mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-status cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--candidate-claim-id",
        "creatine-strength"
      ])
    ).toThrow(
      "Candidate-list filters cannot be combined with --candidate-curation-status."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with queue metadata.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-curation-status cannot be combined with run options.");
  });

  it("does not combine source-candidate reference match mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-reference-matches cannot be combined with --candidate-detail."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--candidate-reference-matches cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-reference-matches cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow(
      "Candidate-list filters cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--candidate-claim-id",
        "creatine-strength"
      ])
    ).toThrow(
      "Candidate-list filters cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-reference-matches cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-reference-matches cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow(
      "--candidate-reference-matches cannot be combined with queue options."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow(
      "--candidate-reference-matches cannot be combined with queue metadata."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-reference-matches cannot be combined with run options.");
  });

  it("requires explicit and isolated source-candidate review options", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--accept-candidate requires --accepted-reference-id.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--accepted-reference-id requires --accept-candidate.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--review-note", "Reviewed."])
    ).toThrow("--review-note requires --accept-candidate or --reject-candidate.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--accepted-reference-id requires --accept-candidate.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--reject-candidate",
        "clinicaltrials.gov|au|creatine|nct123"
      ])
    ).toThrow("Only one source-candidate review option can be used at a time.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow("Candidate-list filters cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--summary"
      ])
    ).toThrow("Review options cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--candidates"
      ])
    ).toThrow("Review options cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--candidate-source",
        "pubmed"
      ])
    ).toThrow("Candidate-list filters cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--candidate-intervention-id",
        "creatine"
      ])
    ).toThrow("Candidate-list filters cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("Review options cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("Review options cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow("Review options cannot be combined with queue metadata.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("Review options cannot be combined with run options.");
  });

  it("does not combine candidate review queue mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidates-limit", "2"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-source", "pubmed"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-decision", "accepted"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-job-id", "job-pubmed"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-intervention-id", "creatine"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-claim-id", "creatine-strength"])
    ).toThrow("Candidate-list filters require --candidates.");
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
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidate-decision",
        "other"
      ])
    ).toThrow("--candidate-decision must be pending, accepted, or rejected.");
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

  it("prints one read-only source-candidate detail record", async () => {
    const stdout = vi.fn();
    const getCandidate = vi.fn().mockResolvedValue(
      sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        interventionId: "creatine",
        claimId: "creatine-strength",
        ingestionJobId: "job-pubmed",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt: "2026-06-02T03:00:00.000Z",
        reviewNote: "Matched PMID and claim context.",
        metadata: {
          authors: ["Smith J", "Jones A"],
          journal: "Example Journal",
          nested: {
            ignored: true
          },
          unknownScalar: "ignored",
          publicationDate: "2017-06-13",
          score: 3
        }
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCandidate, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCandidate).toHaveBeenCalledWith("pubmed|au|creatine|28615996");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate detail",
        'dedupe="pubmed|au|creatine|28615996"',
        'source="PubMed"',
        'externalId="28615996"',
        'region="AU"',
        'query="creatine strength"',
        'title="Creatine position stand"',
        "url=https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "triage=80/100",
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        "publishedYear=2017",
        'sourceType="Review"',
        "abstractAvailable=true",
        "intervention=creatine",
        "claim=creatine-strength",
        "ingestionJob=job-pubmed",
        "acceptedReference=ref-creatine-position-stand",
        "reviewed=2026-06-02T03:00:00.000Z",
        'reviewNote="Matched PMID and claim context."',
        "triageReasons:",
        '  - "Title matches query"',
        "metadata:",
        '  authors="Smith J, Jones A"',
        '  journal="Example Journal"',
        '  publicationDate="2017-06-13"'
      ].join("\n")
    );
  });

  it("escapes multiline detail values and bounds metadata arrays", async () => {
    const stdout = vi.fn();
    const getCandidate = vi.fn().mockResolvedValue(
      sourceCandidate({
        query: "creatine\tstrength",
        title: "Creatine\nposition \u001b[31m",
        triageReasons: ["First\nreason", "Second \u001b[31m"],
        reviewNote: "Line 1\nLine 2",
        metadata: {
          authors: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"],
          doi: null,
          journal: "Journal\nName",
          nested: {
            ignored: true
          },
          upstreamSource: "PubMed\u001b[0m"
        }
      })
    );

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCandidate }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate detail",
        'dedupe="pubmed|au|creatine|28615996"',
        'source="PubMed"',
        'externalId="28615996"',
        'region="AU"',
        'query="creatine\\tstrength"',
        'title="Creatine\\nposition \\u001b[31m"',
        "url=https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "triage=80/100",
        'decision="Pending review"',
        'reviewStatus="Unreviewed AI draft"',
        "publishedYear=2017",
        'sourceType="Review"',
        "abstractAvailable=true",
        'reviewNote="Line 1\\nLine 2"',
        "triageReasons:",
        '  - "First\\nreason"',
        '  - "Second \\u001b[31m"',
        "metadata:",
        '  authors="A1, A2, A3, A4, A5, A6, A7, A8, +2 more"',
        '  journal="Journal\\nName"',
        '  upstreamSource="PubMed\\u001b[0m"'
      ].join("\n")
    );
  });

  it("returns a failing exit code when source-candidate detail is missing", async () => {
    const stderr = vi.fn();
    const getCandidate = vi.fn().mockResolvedValue(null);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", "missing-candidate"],
        { stderr },
        { getCandidate, runNextJob }
      )
    ).resolves.toBe(1);

    expect(getCandidate).toHaveBeenCalledWith("missing-candidate");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Source candidate not found: "missing-candidate"'
    );
  });

  it("prints read-only source-candidate curation status for public-ready accepted candidates", async () => {
    const stdout = vi.fn();
    const getCurationStatus = vi.fn().mockResolvedValue({
      acceptedReference: {
        id: "ref-creatine-position-stand",
        title: "Creatine position stand",
        source: "PubMed",
        identifier: "PMID: 28615996",
        year: 2017,
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
      },
      acceptedReferenceId: "ref-creatine-position-stand",
      candidate: sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength"
      }),
      candidateClaimLinked: true,
      claimLinks: [
        {
          claimId: "creatine-strength",
          relevance: 5,
          note: "Primary source."
        }
      ],
      publicSourcePacketReady: true,
      status: "Public source packet ready",
      studies: [
        {
          id: "study-creatine-issn",
          referenceId: "ref-creatine-position-stand",
          title: "Creatine\nposition stand extraction",
          year: 2017
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationStatus, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCurationStatus).toHaveBeenCalledWith("pubmed|au|creatine|28615996");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        'dedupe="pubmed|au|creatine|28615996"',
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Public source packet ready"',
        "publicSourcePacketReady=true",
        "acceptedReference=ref-creatine-position-stand",
        'acceptedReferenceTitle="Creatine position stand"',
        "acceptedReferenceUrl=https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "candidateClaim=creatine-strength",
        "candidateClaimLinked=true",
        "claimLinks=1",
        "studies=1",
        "claimLinks:",
        '  - claim=creatine-strength relevance=5 note="Primary source."',
        "studies:",
        '  - study=study-creatine-issn reference=ref-creatine-position-stand title="Creatine\\nposition stand extraction" year=2017'
      ].join("\n")
    );
  });

  it("prints read-only curation status for source candidates that are not accepted", async () => {
    const stdout = vi.fn();
    const getCurationStatus = vi.fn().mockResolvedValue({
      candidate: sourceCandidate(),
      claimLinks: [],
      publicSourcePacketReady: false,
      status: "Not accepted",
      studies: []
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationStatus, runNextJob }
      )
    ).resolves.toBe(0);

    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        'dedupe="pubmed|au|creatine|28615996"',
        'decision="Pending review"',
        'reviewStatus="Unreviewed AI draft"',
        'status="Not accepted"',
        "publicSourcePacketReady=false",
        "claimLinks=0",
        "studies=0"
      ].join("\n")
    );
  });

  it("returns a failing exit code when curation status targets a missing candidate", async () => {
    const stderr = vi.fn();
    const getCurationStatus = vi.fn().mockResolvedValue(null);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "missing-candidate"],
        { stderr },
        { getCurationStatus, runNextJob }
      )
    ).resolves.toBe(1);

    expect(getCurationStatus).toHaveBeenCalledWith("missing-candidate");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Source candidate not found: "missing-candidate"'
    );
  });

  it("prints read-only source-candidate accepted-reference matches", async () => {
    const stdout = vi.fn();
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate: sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996",
        source: "PubMed"
      }),
      references: [
        {
          id: "ref-creatine-position-stand",
          title: "Creatine position stand",
          source: "PubMed",
          identifier: "PMID: 28615996",
          year: 2017,
          url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
        },
        {
          id: "ref-creatine-publisher",
          title: "Creatine\npublisher record",
          source: "PubMed",
          url: "https://publisher.example/creatine-position-stand"
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "pubmed|au|creatine|28615996"],
        { stdout },
        { listReferenceMatches, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listReferenceMatches).toHaveBeenCalledWith(
      "pubmed|au|creatine|28615996"
    );
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        'Source-candidate accepted-reference matches: total=2 dedupe="pubmed|au|creatine|28615996"',
        '- reference="ref-creatine-position-stand" source="PubMed" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ identifier="PMID: 28615996" year=2017',
        '- reference="ref-creatine-publisher" source="PubMed" title="Creatine\\npublisher record" url=https://publisher.example/creatine-position-stand'
      ].join("\n")
    );
  });

  it("prints an empty source-candidate accepted-reference match list", async () => {
    const stdout = vi.fn();
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate: sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov"
      }),
      references: []
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "clinicaltrials.gov|au|creatine|nct123"],
        { stdout },
        { listReferenceMatches }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      'Source-candidate accepted-reference matches: total=0 dedupe="clinicaltrials.gov|au|creatine|nct123"'
    );
  });

  it("returns a failing exit code when reference matches target a missing candidate", async () => {
    const stderr = vi.fn();
    const listReferenceMatches = vi.fn().mockResolvedValue(null);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "missing-candidate"],
        { stderr },
        { listReferenceMatches, runNextJob }
      )
    ).resolves.toBe(1);

    expect(listReferenceMatches).toHaveBeenCalledWith("missing-candidate");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Source candidate not found: "missing-candidate"'
    );
  });

  it("records an accepted source-candidate review decision", async () => {
    const stdout = vi.fn();
    const recordDecision = vi.fn().mockResolvedValue(
      sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt: "2026-06-02T01:00:00.000Z",
        reviewNote: "Full-text reviewed."
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--accept-candidate",
          "pubmed|au|creatine|28615996",
          "--accepted-reference-id",
          "ref-creatine-position-stand",
          "--review-note",
          "Full-text reviewed."
        ],
        { stdout },
        { recordDecision, runNextJob }
      )
    ).resolves.toBe(0);

    expect(recordDecision).toHaveBeenCalledWith({
      dedupeKey: "pubmed|au|creatine|28615996",
      decision: "Accepted",
      acceptedReferenceId: "ref-creatine-position-stand",
      reviewNote: "Full-text reviewed."
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[Accepted] source-candidate PubMed AU dedupe="pubmed|au|creatine|28615996" title="Creatine position stand" reviewStatus="Human reviewed" acceptedReference=ref-creatine-position-stand note="Full-text reviewed."'
    );
  });

  it("records a rejected source-candidate review decision", async () => {
    const stdout = vi.fn();
    const recordDecision = vi.fn().mockResolvedValue(
      sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/NCT123",
        decision: "Rejected",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: undefined,
        reviewedAt: "2026-06-02T02:00:00.000Z",
        reviewNote: "Not relevant to the consumer claim."
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--reject-candidate",
          "clinicaltrials.gov|au|creatine|nct123",
          "--review-note",
          "Not relevant to the consumer claim."
        ],
        { stdout },
        { recordDecision, runNextJob }
      )
    ).resolves.toBe(0);

    expect(recordDecision).toHaveBeenCalledWith({
      dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
      decision: "Rejected",
      acceptedReferenceId: undefined,
      reviewNote: "Not relevant to the consumer claim."
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[Rejected] source-candidate ClinicalTrials.gov AU dedupe="clinicaltrials.gov|au|creatine|nct123" title="Creatine and aging" reviewStatus="Human reviewed" note="Not relevant to the consumer claim."'
    );
  });

  it("returns a failing exit code when source-candidate review fails", async () => {
    const stderr = vi.fn();
    const recordDecision = vi
      .fn()
      .mockRejectedValue(
        new Error("Accepted source candidates require an acceptedReferenceId.")
      );

    await expect(
      runSourceCandidateJobCommand(
        [
          "--accept-candidate",
          "pubmed|au|creatine|28615996",
          "--accepted-reference-id",
          "ref-creatine-position-stand"
        ],
        { stderr },
        { recordDecision }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith(
      "Accepted source candidates require an acceptedReferenceId."
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
          "pubmed",
          "--candidate-job-id",
          "job-pubmed",
          "--candidate-intervention-id",
          "creatine",
          "--candidate-claim-id",
          "creatine-strength"
        ],
        { stdout },
        { listCandidates, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: "creatine-strength",
      decision: undefined,
      ingestionJobId: "job-pubmed",
      interventionId: "creatine",
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

  it("prints read-only reviewed source-candidate records", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([
      sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        reviewedAt: "2026-06-02T03:00:00.000Z",
        reviewNote: "Matched PMID and claim context.",
        interventionId: "creatine",
        claimId: "creatine-strength"
      })
    ]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidates",
          "--candidate-decision",
          "accepted",
          "--candidates-limit",
          "1"
        ],
        { stdout },
        { listCandidates, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: undefined,
      decision: "Accepted",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: 1,
      source: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        'Source-candidate review records: decision="Accepted": total=1',
        '- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ decision="Accepted" reviewStatus="Human reviewed" acceptedReference=ref-creatine-position-stand reviewed=2026-06-02T03:00:00.000Z note="Matched PMID and claim context." intervention=creatine claim=creatine-strength'
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

  it("prints explicit pending source-candidate decisions as the review queue", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([
      sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996|creatine-strength",
        title: "Creatine position stand"
      })
    ]);

    await expect(
      runSourceCandidateJobCommand(
        ["--candidates", "--candidate-decision", "pending"],
        { stdout },
        { listCandidates }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: undefined,
      decision: "Pending review",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: undefined,
      source: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review queue: total=1",
        '- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996|creatine-strength" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/'
      ].join("\n")
    );
  });

  it("prints an empty reviewed source-candidate record list", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([]);

    await expect(
      runSourceCandidateJobCommand(
        ["--candidates", "--candidate-decision", "rejected"],
        { stdout },
        { listCandidates }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: undefined,
      decision: "Rejected",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: undefined,
      source: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      'Source-candidate review records: decision="Rejected": total=0'
    );
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
