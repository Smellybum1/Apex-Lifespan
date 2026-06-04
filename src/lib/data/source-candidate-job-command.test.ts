import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  commandUsage,
  parseSourceCandidateJobCommandArgs,
  runSourceCandidateJobCommand
} from "@/lib/data/source-candidate-job-command";

function safeCandidateKey(dedupeKey: string) {
  return `b64:${Buffer.from(dedupeKey, "utf8").toString("base64url")}`;
}

const BROAD_SAFETY_CAUTION =
  "Broad safety/adverse query; verify title, population, outcomes, and source identity against the candidate claim.";
const LOW_TITLE_OVERLAP_CAUTION =
  "Low title/query overlap; inspect the packet and siblings for off-claim or off-intervention matches.";
const DUPLICATE_IDENTITY_CAUTION =
  "Same source/external id appears in multiple candidate contexts; compare duplicate identity rows before accepting or rejecting any candidate.";

describe("commandUsage", () => {
  it("describes source-candidate review guardrails", () => {
    expect(commandUsage()).toContain(
      "--candidate-detail <dedupe-key>   Print one source-candidate detail record with review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-reference-matches <dedupe-key> Print accepted-reference matches and review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-review-flags        Print read-only flagged pending review groups with review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-review-flag <flag>  With --candidate-review-flags, filter by broad-safety-query or low-title-query-overlap."
    );
    expect(commandUsage()).toContain(
      "--candidate-review-overview     Print read-only pending review groups with review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-region <region>       Filter candidates, overview, flags, or handoff by region."
    );
    expect(commandUsage()).toContain(
      "--candidate-claim-missing         Filter candidates, overview, flags, or handoff to rows without claim id."
    );
    expect(commandUsage()).toContain(
      "--candidate-intervention-missing  Filter candidates, overview, flags, or handoff to rows without intervention id."
    );
    expect(commandUsage()).toContain(
      "--candidate-review-packet <dedupe-key> Print detail, accepted-reference matches, sibling/duplicate context, and curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidates                      Print read-only source-candidate review rows with review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-siblings <dedupe-key> Print source-candidate siblings with match reasons and review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-curation-draft <dedupe-key> Print read-only claim-link/study draft fields with command hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-curation-status <dedupe-key> Print curation handoff status, next action, and command hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-curation-handoff      Print accepted source-candidate curation handoff rows, next actions, and command hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-curation-handoff-status <status> Filter handoff by missing-reference, reference-mismatch, candidate-claim-missing, claim-link-missing, extraction-pending, or ready."
    );
    expect(commandUsage()).toContain(
      "--candidate-duplicates            With --candidates, print read-only duplicate source/external-id groups with review/curation hints."
    );
    expect(commandUsage()).toContain(
      "--candidate-external-id <id>      Filter --candidates by source external id such as PMID or NCT id."
    );
    expect(commandUsage()).toContain(
      "<dedupe-key> also accepts emitted key=b64:... values for shell-safe reuse."
    );
    expect(commandUsage()).toContain(
      "--review-note <note>              Human review note; required for --accept-candidate and --reject-candidate."
    );
    expect(commandUsage()).toContain(
      "--link-candidate-claim <dedupe-key> Link an accepted candidate reference to its claim."
    );
    expect(commandUsage()).toContain(
      "--extract-candidate-study <dedupe-key> Write structured Study extraction for an accepted, claim-linked candidate."
    );
    expect(commandUsage()).toContain(
      "--study-source-type <type>        Optional study type override: meta-analysis, systematic-review, randomized-controlled-trial, observational-cohort, case-report, animal-study, in-vitro-mechanistic, clinical-trial-record, or regulatory-safety-warning."
    );
    expect(commandUsage()).toContain(
      "--queue-claim-sources <claim-id>  Queue PubMed and ClinicalTrials.gov jobs from claim context."
    );
    expect(commandUsage()).toContain(
      "--jobs-status <status>            Filter --jobs by queued, running, succeeded, failed, or skipped."
    );
    expect(commandUsage()).toContain(
      "--jobs                            Print recent source-candidate ingestion jobs with read-only hints."
    );
    expect(commandUsage()).toContain(
      "--jobs-claim-id <id>              Filter --jobs by claim id."
    );
    expect(commandUsage()).toContain(
      "--run-next                        Run queued PubMed/ClinicalTrials.gov jobs."
    );
    expect(commandUsage()).toContain(
      "--limit <count>                   With --run-next, run up to count queued jobs (default 1, max 25)."
    );
  });
});

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

    expect(() =>
      parseSourceCandidateJobCommandArgs(["--limit", "2"])
    ).toThrow("--limit requires --run-next.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(["--pubmed-retmax", "3"])
    ).toThrow(
      "--pubmed-retmax and --clinical-trial-page-size require --run-next or --job-id."
    );

    expect(() =>
      parseSourceCandidateJobCommandArgs(["--run-next", "--job-id", "job-pubmed"])
    ).toThrow("--run-next cannot be combined with --job-id.");
  });

  it("parses read-only summary mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--summary"])).toEqual({
      help: false,
      limit: 1,
      summary: true
    });
  });

  it("parses read-only source-candidate detail mode", () => {
    const encodedKey = safeCandidateKey("pubmed|au|creatine|28615996");

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
    expect(
      parseSourceCandidateJobCommandArgs(["--candidate-detail", encodedKey])
        .candidateDetailDedupeKey
    ).toBe("pubmed|au|creatine|28615996");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-detail", "b64:not valid"])
    ).toThrow("--candidate-detail has an invalid b64 candidate key.");
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

  it("parses read-only source-candidate review packet mode", () => {
    const encodedKey = safeCandidateKey("pubmed|au|creatine|28615996");

    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996"
      ])
    ).toEqual({
      candidateReviewPacketDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs(["--candidate-review-packet", encodedKey])
        .candidateReviewPacketDedupeKey
    ).toBe("pubmed|au|creatine|28615996");
  });

  it("parses read-only source-candidate sibling mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidate-siblings-limit",
        "200"
      ])
    ).toEqual({
      candidateSiblingsDedupeKey: "pubmed|au|creatine|28615996",
      candidateSiblingsLimit: 50,
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

  it("parses read-only source-candidate curation draft mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996"
      ])
    ).toEqual({
      candidateCurationDraftDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only source-candidate curation handoff mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--candidate-curation-handoff"])).toEqual({
      candidateCurationHandoff: true,
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-limit",
        "200",
        "--candidate-source",
        "pubmed",
        "--candidate-region",
        "AU",
        "--candidate-job-id",
        "job-pubmed",
        "--candidate-intervention-id",
        "creatine",
        "--candidate-claim-id",
        "creatine-strength",
        "--candidate-curation-handoff-status",
        "ready"
      ])
    ).toEqual({
      candidateClaimId: "creatine-strength",
      candidateCurationHandoff: true,
      candidateCurationHandoffLimit: 50,
      candidateCurationHandoffStatus: "Public source packet ready",
      candidateInterventionId: "creatine",
      candidateJobId: "job-pubmed",
      candidateRegion: "AU",
      candidateSource: "PubMed",
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-claim-missing",
        "--candidate-intervention-missing"
      ])
    ).toEqual({
      candidateClaimMissing: true,
      candidateCurationHandoff: true,
      candidateInterventionMissing: true,
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses source-candidate curation handoff status aliases", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "missing-reference"
      ]).candidateCurationHandoffStatus
    ).toBe("Accepted reference missing");
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "reference-mismatch"
      ]).candidateCurationHandoffStatus
    ).toBe("Accepted reference mismatch");
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "candidate-claim-missing"
      ]).candidateCurationHandoffStatus
    ).toBe("Candidate claim missing");
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "claim-link-missing"
      ]).candidateCurationHandoffStatus
    ).toBe("Claim link missing");
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "extraction-pending"
      ]).candidateCurationHandoffStatus
    ).toBe("Extraction pending");
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
        "--accept-candidate",
        safeCandidateKey("pubmed|au|creatine|28615996"),
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        "Full-text reviewed."
      ]).reviewCandidateDedupeKey
    ).toBe("pubmed|au|creatine|28615996");

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

  it("parses guarded source-candidate claim-link mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--claim-link-note",
        "Primary source for this claim.",
        "--claim-link-relevance",
        "9"
      ])
    ).toEqual({
      claimLinkNote: "Primary source for this claim.",
      claimLinkRelevance: 5,
      help: false,
      limit: 1,
      linkCandidateClaimDedupeKey: "pubmed|au|creatine|28615996",
      summary: false
    });
  });

  it("parses guarded source-candidate study extraction mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs([
          "--study-source-type",
          "rct",
          "--study-dose",
          "3-5 g/day",
          "--study-duration",
          "12 weeks",
          "--study-main-results",
          "Strength improved.",
          "--study-abstract",
          "Trial abstract.",
          "--study-relevance",
          "9",
          "--update-existing-study"
        ])
      )
    ).toEqual({
      extractCandidateStudyDedupeKey: "pubmed|au|creatine|28615996",
      help: false,
      limit: 1,
      studyAbstract: "Trial abstract.",
      studyAdverseEvents: "No serious adverse events reported.",
      studyDose: "3-5 g/day",
      studyDuration: "12 weeks",
      studyFundingConflicts: "Funding conflicts disclosed.",
      studyInterventionName: "Creatine monohydrate",
      studyMainResults: "Strength improved.",
      studyOutcomes: ["Strength", "Lean mass"],
      studyPopulation: "Healthy adults",
      studyRelevance: 5,
      studyRiskOfBias: "Moderate risk of bias.",
      studySampleSize: "n=80",
      studySourceType: "RANDOMIZED_CONTROLLED_TRIAL",
      studyUpdateExisting: true,
      summary: false
    });
  });

  it("fails closed on incomplete source-candidate study extraction options", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--study-sample-size", "n=80"])
    ).toThrow("Study extraction options require --extract-candidate-study.");

    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--extract-candidate-study",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("Study extraction requires --study-sample-size.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs(["--study-source-type", "unknown-type"])
      )
    ).toThrow(
      "--study-source-type must be meta-analysis, systematic-review, randomized-controlled-trial, observational-cohort, case-report, animal-study, in-vitro-mechanistic, clinical-trial-record, or regulatory-safety-warning."
    );
  });

  it("does not combine source-candidate study extraction with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs(["--candidate-detail", "pubmed|au|creatine|28615996"])
      )
    ).toThrow("--candidate-detail cannot be combined with --extract-candidate-study.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(studyCommandArgs(["--summary"]))
    ).toThrow("--extract-candidate-study cannot be combined with --summary.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs([
          "--accept-candidate",
          "pubmed|au|creatine|28615996",
          "--accepted-reference-id",
          "ref-creatine-position-stand",
          "--review-note",
          "Full-text reviewed."
        ])
      )
    ).toThrow("Review options cannot be combined with --extract-candidate-study.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs(["--link-candidate-claim", "pubmed|au|creatine|28615996"])
      )
    ).toThrow(
      "--link-candidate-claim cannot be combined with --extract-candidate-study."
    );

    expect(() =>
      parseSourceCandidateJobCommandArgs(
        studyCommandArgs(["--candidate-claim-id", "creatine-strength"])
      )
    ).toThrow("Candidate-list filters cannot be combined with --extract-candidate-study.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(studyCommandArgs(["--queue-pubmed", "creatine"]))
    ).toThrow("--extract-candidate-study cannot be combined with queue options.");

    expect(() =>
      parseSourceCandidateJobCommandArgs(studyCommandArgs(["--limit", "2"]))
    ).toThrow("--extract-candidate-study cannot be combined with run options.");
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
        "--candidate-duplicates",
        "--candidate-external-id",
        "NCT123",
        "--candidate-job-id",
        "job-pubmed",
        "--candidate-intervention-id",
        "creatine",
        "--candidate-claim-id",
        "creatine-strength",
        "--candidate-region",
        "au"
      ])
    ).toEqual({
      candidates: true,
      candidateClaimId: "creatine-strength",
      candidateDecision: "Accepted",
      candidateDuplicates: true,
      candidateExternalId: "NCT123",
      candidateInterventionId: "creatine",
      candidateJobId: "job-pubmed",
      candidateRegion: "AU",
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
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidate-claim-missing",
        "--candidate-intervention-missing"
      ])
    ).toEqual({
      candidates: true,
      candidateClaimMissing: true,
      candidateInterventionMissing: true,
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only candidate review overview mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--candidate-review-overview"])).toEqual({
      candidateReviewOverview: true,
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--candidate-review-overview-limit",
        "200",
        "--candidate-source",
        "pubmed",
        "--candidate-job-id",
        "job-pubmed",
        "--candidate-intervention-id",
        "omega-3",
        "--candidate-claim-id",
        "omega-3-cv-events",
        "--candidate-region",
        "AU"
      ])
    ).toEqual({
      candidateClaimId: "omega-3-cv-events",
      candidateInterventionId: "omega-3",
      candidateJobId: "job-pubmed",
      candidateRegion: "AU",
      candidateReviewOverview: true,
      candidateReviewOverviewLimit: 50,
      candidateSource: "PubMed",
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--candidate-claim-missing",
        "--candidate-intervention-missing"
      ])
    ).toEqual({
      candidateClaimMissing: true,
      candidateInterventionMissing: true,
      candidateReviewOverview: true,
      help: false,
      limit: 1,
      summary: false
    });
  });

  it("parses read-only candidate review flags mode", () => {
    expect(parseSourceCandidateJobCommandArgs(["--candidate-review-flags"])).toEqual({
      candidateReviewFlags: true,
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-review-flag",
        "broad-safety-query",
        "--candidate-review-flags-limit",
        "200",
        "--candidate-source",
        "clinical-trials",
        "--candidate-job-id",
        "job-trials",
        "--candidate-intervention-id",
        "vitamin-d",
        "--candidate-claim-id",
        "vitamin-d-deficiency",
        "--candidate-region",
        "AU"
      ])
    ).toEqual({
      candidateClaimId: "vitamin-d-deficiency",
      candidateInterventionId: "vitamin-d",
      candidateJobId: "job-trials",
      candidateRegion: "AU",
      candidateReviewFlag: "broad-safety-query",
      candidateReviewFlags: true,
      candidateReviewFlagsLimit: 50,
      candidateSource: "ClinicalTrials.gov",
      help: false,
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-claim-missing",
        "--candidate-intervention-missing"
      ])
    ).toEqual({
      candidateClaimMissing: true,
      candidateInterventionMissing: true,
      candidateReviewFlags: true,
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
    expect(
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-status", "queued"])
    ).toEqual({
      help: false,
      jobs: true,
      jobsStatus: "QUEUED",
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs([
        "--jobs",
        "--jobs-source",
        "pubmed",
        "--jobs-region",
        "au",
        "--jobs-intervention-id",
        "creatine",
        "--jobs-claim-id",
        "creatine-strength"
      ])
    ).toEqual({
      help: false,
      jobs: true,
      jobsSource: "PubMed",
      jobsRegion: "au",
      jobsInterventionId: "creatine",
      jobsClaimId: "creatine-strength",
      limit: 1,
      summary: false
    });
    expect(
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-status", "success"])
        .jobsStatus
    ).toBe("SUCCEEDED");
    expect(
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-status", "failure"])
        .jobsStatus
    ).toBe("FAILED");
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

  it("parses claim source queue mode", () => {
    expect(
      parseSourceCandidateJobCommandArgs([
        "--queue-claim-sources",
        "creatine-strength",
        "--region",
        "nz"
      ])
    ).toEqual({
      help: false,
      limit: 1,
      queueClaimSourcesClaimId: "creatine-strength",
      region: "nz",
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
        "--candidate-claim-missing"
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

  it("does not combine source-candidate curation draft mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-draft cannot be combined with --candidate-curation-status."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-draft cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidate-siblings",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with --candidate-siblings.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--candidate-claim-id",
        "creatine-strength"
      ])
    ).toThrow(
      "Candidate-list filters cannot be combined with --candidate-curation-draft."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with queue metadata.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-curation-draft cannot be combined with run options.");
  });

  it("does not combine source-candidate curation handoff mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-handoff cannot be combined with --candidate-curation-status."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-handoff cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--summary"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidates"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow(
      "--candidate-decision cannot be combined with --candidate-curation-handoff."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-external-id",
        "28615996"
      ])
    ).toThrow(
      "--candidate-external-id cannot be combined with --candidate-curation-handoff."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidates-limit",
        "5"
      ])
    ).toThrow(
      "--candidates-limit cannot be combined with --candidate-curation-handoff."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-curation-handoff", "--jobs"])
    ).toThrow("--candidate-curation-handoff cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--region",
        "AU"
      ])
    ).toThrow(
      "--candidate-curation-handoff cannot be combined with queue metadata."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--job-id",
        "job-pubmed"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--pubmed-retmax",
        "2"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--clinical-trial-page-size",
        "2"
      ])
    ).toThrow("--candidate-curation-handoff cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-curation-handoff-limit", "5"])
    ).toThrow(
      "--candidate-curation-handoff-limit requires --candidate-curation-handoff."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff-status",
        "ready"
      ])
    ).toThrow(
      "--candidate-curation-handoff-status requires --candidate-curation-handoff."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-curation-handoff",
        "--candidate-curation-handoff-status",
        "excellent"
      ])
    ).toThrow(
      "--candidate-curation-handoff-status must be missing-reference, reference-mismatch, candidate-claim-missing, claim-link-missing, extraction-pending, or ready."
    );
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

  it("does not combine source-candidate review packet mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-detail cannot be combined with --candidate-review-packet.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-reference-matches cannot be combined with --candidate-review-packet."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--candidate-siblings",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-siblings cannot be combined with --candidate-review-packet.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-review-packet cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--candidate-source",
        "pubmed"
      ])
    ).toThrow(
      "Candidate-list filters cannot be combined with --candidate-review-packet."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-review-packet cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(studyCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996"
      ]))
    ).toThrow(
      "--candidate-review-packet cannot be combined with --extract-candidate-study."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-review-packet cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-review-packet cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-packet",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-review-packet cannot be combined with run options.");
  });

  it("does not combine source-candidate sibling mode with other command modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-siblings cannot be combined with --candidate-detail.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidate-curation-status",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-siblings cannot be combined with --candidate-curation-status."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidate-reference-matches",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-siblings cannot be combined with --candidate-reference-matches."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--candidate-siblings cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidates"
      ])
    ).toThrow("--candidate-siblings cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--candidate-source",
        "pubmed"
      ])
    ).toThrow("Candidate-list filters cannot be combined with --candidate-siblings.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--candidate-siblings cannot be combined with review options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--jobs"
      ])
    ).toThrow("--candidate-siblings cannot be combined with --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--candidate-siblings cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--region",
        "AU"
      ])
    ).toThrow("--candidate-siblings cannot be combined with queue metadata.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-siblings",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--candidate-siblings cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-siblings-limit", "5"])
    ).toThrow("--candidate-siblings-limit requires --candidate-siblings.");
  });

  it("requires isolated source-candidate claim-link options", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--claim-link-note", "Primary source."])
    ).toThrow("--claim-link-note requires --link-candidate-claim.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--claim-link-relevance", "4"])
    ).toThrow("--claim-link-relevance requires --link-candidate-claim.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--candidate-detail",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--candidate-detail cannot be combined with --link-candidate-claim.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--candidate-curation-draft",
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow(
      "--candidate-curation-draft cannot be combined with --link-candidate-claim."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--summary"
      ])
    ).toThrow("--link-candidate-claim cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--candidate-claim-id",
        "creatine-strength"
      ])
    ).toThrow("Candidate-list filters cannot be combined with --link-candidate-claim.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        "Full-text reviewed."
      ])
    ).toThrow("Review options cannot be combined with --link-candidate-claim.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("--link-candidate-claim cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--link-candidate-claim",
        "pubmed|au|creatine|28615996",
        "--limit",
        "2"
      ])
    ).toThrow("--link-candidate-claim cannot be combined with run options.");
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
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand"
      ])
    ).toThrow("--accept-candidate requires --review-note.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        " "
      ])
    ).toThrow("--accept-candidate requires --review-note.");
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
        "pubmed|au|creatine|28615996"
      ])
    ).toThrow("--reject-candidate requires --review-note.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--reject-candidate",
        "pubmed|au|creatine|28615996",
        "--review-note",
        " "
      ])
    ).toThrow("--reject-candidate requires --review-note.");
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
        "--review-note",
        "Full-text reviewed.",
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
        "--review-note",
        "Full-text reviewed.",
        "--summary"
      ])
    ).toThrow("Review options cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        "Full-text reviewed.",
        "--candidates"
      ])
    ).toThrow("Review options cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--accept-candidate",
        "pubmed|au|creatine|28615996",
        "--accepted-reference-id",
        "ref-creatine-position-stand",
        "--review-note",
        "Full-text reviewed.",
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
        "--review-note",
        "Full-text reviewed.",
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
      parseSourceCandidateJobCommandArgs(["--candidate-duplicates"])
    ).toThrow("--candidate-duplicates requires --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-external-id", "28615996"])
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
      parseSourceCandidateJobCommandArgs(["--candidate-claim-missing"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-intervention-missing"])
    ).toThrow("Candidate-list filters require --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidate-claim-id",
        "creatine-strength",
        "--candidate-claim-missing"
      ])
    ).toThrow("--candidate-claim-missing cannot be combined with --candidate-claim-id.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidates",
        "--candidate-intervention-id",
        "creatine",
        "--candidate-intervention-missing"
      ])
    ).toThrow(
      "--candidate-intervention-missing cannot be combined with --candidate-intervention-id."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-region", "AU"])
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

  it("does not combine candidate review overview mode with write or run modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-overview-limit", "2"])
    ).toThrow("--candidate-review-overview-limit requires --candidate-review-overview.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow("--candidate-decision cannot be combined with --candidate-review-overview.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--candidate-external-id",
        "32634581"
      ])
    ).toThrow("--candidate-external-id cannot be combined with --candidate-review-overview.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--candidate-duplicates"
      ])
    ).toThrow("--candidate-duplicates cannot be combined with --candidate-review-overview.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-overview", "--summary"])
    ).toThrow("--candidate-review-overview cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-overview", "--candidates"])
    ).toThrow("--candidate-review-overview cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--queue-pubmed",
        "omega-3"
      ])
    ).toThrow("--candidate-review-overview cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-overview", "--limit", "2"])
    ).toThrow("--candidate-review-overview cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-overview",
        "--accept-candidate",
        "pubmed|au|omega|32634581"
      ])
    ).toThrow("--candidate-review-overview cannot be combined with review options.");
  });

  it("does not combine candidate review flags mode with write or run modes", () => {
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-flags-limit", "2"])
    ).toThrow("--candidate-review-flags-limit requires --candidate-review-flags.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-flag", "broad-safety-query"])
    ).toThrow("--candidate-review-flag requires --candidate-review-flags.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-review-flag",
        "unsupported-flag"
      ])
    ).toThrow(
      "--candidate-review-flag must be broad-safety-query or low-title-query-overlap."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-decision",
        "accepted"
      ])
    ).toThrow("--candidate-decision cannot be combined with --candidate-review-flags.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-external-id",
        "NCT00715676"
      ])
    ).toThrow("--candidate-external-id cannot be combined with --candidate-review-flags.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-duplicates"
      ])
    ).toThrow("--candidate-duplicates cannot be combined with --candidate-review-flags.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--candidate-review-overview"
      ])
    ).toThrow(
      "--candidate-review-flags cannot be combined with --candidate-review-overview."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-flags", "--summary"])
    ).toThrow("--candidate-review-flags cannot be combined with --summary.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-flags", "--candidates"])
    ).toThrow("--candidate-review-flags cannot be combined with --candidates.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--queue-pubmed",
        "vitamin d"
      ])
    ).toThrow("--candidate-review-flags cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--candidate-review-flags", "--limit", "2"])
    ).toThrow("--candidate-review-flags cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--candidate-review-flags",
        "--accept-candidate",
        "clinicaltrials.gov|au|vitamin-d|nct00715676"
      ])
    ).toThrow("--candidate-review-flags cannot be combined with review options.");
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
      parseSourceCandidateJobCommandArgs([
        "--queue-claim-sources",
        "creatine-strength",
        "--queue-pubmed",
        "creatine"
      ])
    ).toThrow("Only one queue option can be used at a time.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--queue-pubmed", "creatine", "--limit", "2"])
    ).toThrow("Queue options cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--queue-claim-sources",
        "creatine-strength",
        "--limit",
        "2"
      ])
    ).toThrow("Queue options cannot be combined with run options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--queue-pubmed", "creatine", "--summary"])
    ).toThrow("--summary is read-only and cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--queue-claim-sources",
        "creatine-strength",
        "--summary"
      ])
    ).toThrow("--summary is read-only and cannot be combined with queue options.");
    expect(() =>
      parseSourceCandidateJobCommandArgs([
        "--queue-claim-sources",
        "creatine-strength",
        "--claim-id",
        "different-claim"
      ])
    ).toThrow(
      "--intervention-id and --claim-id cannot be combined with --queue-claim-sources."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--region", "AU"])
    ).toThrow("--region, --intervention-id, and --claim-id require a queue option.");
  });

  it("does not combine recent job mode with other command modes", () => {
    expect(() => parseSourceCandidateJobCommandArgs(["--jobs-limit", "2"])).toThrow(
      "--jobs-limit requires --jobs."
    );
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs-status", "queued"])
    ).toThrow("--jobs-status requires --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs-claim-id", "creatine-strength"])
    ).toThrow("Job-list filters require --jobs.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-source", "other"])
    ).toThrow("--jobs-source must be pubmed or clinical-trials.");
    expect(() =>
      parseSourceCandidateJobCommandArgs(["--jobs", "--jobs-status", "waiting"])
    ).toThrow("--jobs-status must be queued, running, succeeded, failed, or skipped.");
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
    const summarizeJobs = vi.fn().mockResolvedValue({
      total: 5,
      groups: [
        {
          source: "PUBMED",
          region: "AU",
          status: "QUEUED",
          count: 2
        },
        {
          source: "CLINICALTRIALS_GOV",
          region: "AU",
          status: "SUCCEEDED",
          count: 3
        }
      ]
    });
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
    const summarizeCurationHandoff = vi.fn().mockResolvedValue({
      total: 6,
      groups: [
        {
          status: "Accepted reference missing",
          publicSourcePacketReady: false,
          count: 1
        },
        {
          status: "Accepted reference mismatch",
          publicSourcePacketReady: false,
          count: 1
        },
        {
          status: "Candidate claim missing",
          publicSourcePacketReady: false,
          count: 1
        },
        {
          status: "Claim link missing",
          publicSourcePacketReady: false,
          count: 1
        },
        {
          status: "Extraction pending",
          publicSourcePacketReady: false,
          count: 1
        },
        {
          status: "Public source packet ready",
          publicSourcePacketReady: true,
          count: 1
        }
      ]
    });
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 15,
      totalGroups: 3,
      groups: [
        {
          claimId: "vitamin-d-deficiency",
          count: 10,
          interventionId: "vitamin-d",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey:
              "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency",
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D safety adverse effects",
            title: "Phase 2 Safety and Efficacy Study of a Vitamin D Compound",
            interventionId: "vitamin-d",
            claimId: "vitamin-d-deficiency"
          }),
          topIdentityCandidateCount: 2,
          topTriageScore: 100
        },
        {
          claimId: "creatine-lifespan",
          count: 1,
          interventionId: "creatine",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey:
              "clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan",
            source: "ClinicalTrials.gov",
            externalId: "NCT07451496",
            query: "Creatine monohydrate longevity mortality lifespan",
            title:
              "PRecision gerOMedicinE: Tailored Healthy agEing With Lifestyle, sUpplements and drugS",
            interventionId: "creatine",
            claimId: "creatine-lifespan"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        },
        {
          claimId: "omega-3-cv-events",
          count: 4,
          interventionId: "omega-3",
          region: "AU",
          source: "PubMed",
          topCandidate: sourceCandidate({
            query: "Omega-3 cardiovascular events prevention",
            title: "Omega-3 cardiovascular outcomes meta-analysis",
            interventionId: "omega-3",
            claimId: "omega-3-cv-events"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        [],
        { stdout },
        {
          listReviewOverview,
          runNextJob,
          summarizeBacklog,
          summarizeCurationHandoff,
          summarizeJobs
        }
      )
    ).resolves.toBe(0);

    expect(runNextJob).not.toHaveBeenCalled();
    expect(summarizeJobs).toHaveBeenCalledTimes(1);
    expect(summarizeBacklog).toHaveBeenCalledTimes(1);
    expect(summarizeCurationHandoff).toHaveBeenCalledTimes(1);
    expect(listReviewOverview).toHaveBeenCalledWith({ limit: 50 });
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate ingestion jobs: total=5",
        "- PUBMED AU QUEUED: 2",
        "- CLINICALTRIALS_GOV AU SUCCEEDED: 3",
        "Source-candidate backlog: total=4",
        "- PubMed AU Pending review / Unreviewed AI draft: 3",
        "- ClinicalTrials.gov AU Accepted / Human reviewed: 1",
        "Source-candidate curation handoff: total=6",
        '- status="Accepted reference missing" publicSourcePacketReady=false: 1 nextAction="Attach or restore the matching curated reference before public packet review." nextWrite="claimLink" writeReady=false blockedUntil="Accepted candidate reference required before claim linking." handoff="--candidate-curation-handoff --candidate-curation-handoff-status missing-reference"',
        '- status="Accepted reference mismatch" publicSourcePacketReady=false: 1 nextAction="Replace the accepted reference with one matching the candidate source and external id." nextWrite="claimLink" writeReady=false blockedUntil="Accepted candidate reference must match candidate source and external id." handoff="--candidate-curation-handoff --candidate-curation-handoff-status reference-mismatch"',
        '- status="Candidate claim missing" publicSourcePacketReady=false: 1 nextAction="Review or queue this candidate with a claim id before public packet review." nextWrite="claimLink" writeReady=false blockedUntil="Accepted candidate claim id required before claim linking." handoff="--candidate-curation-handoff --candidate-curation-handoff-status candidate-claim-missing"',
        '- status="Claim link missing" publicSourcePacketReady=false: 1 nextAction="Link the accepted reference to the candidate claim before public packet review." nextWrite="claimLink" writeReady=true handoff="--candidate-curation-handoff --candidate-curation-handoff-status claim-link-missing"',
        '- status="Extraction pending" publicSourcePacketReady=false: 1 nextAction="Add structured study extraction for the accepted reference." nextWrite="studyExtraction" writeReady=true handoff="--candidate-curation-handoff --candidate-curation-handoff-status extraction-pending"',
        '- status="Public source packet ready" publicSourcePacketReady=true: 1 nextAction="Review for public source packet inclusion." nextWrite="none" writeReady=false handoff="--candidate-curation-handoff --candidate-curation-handoff-status ready"',
        "Source-candidate review flag focus: totalGroups=3 candidateCount=15 flaggedTopGroups=2",
        `- flag="broad-safety-query" topGroups=1 pendingInTopGroups=10 topGroup="vitamin-d-deficiency vitamin-d ClinicalTrials.gov AU" caution="${BROAD_SAFETY_CAUTION}" topIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source clinical-trials --candidate-external-id NCT00715676 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" list="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" packet="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency")}" siblings="--candidate-siblings ${safeCandidateKey("clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency")}" curationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency")}" flags="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" overview="--candidate-review-overview --candidate-review-overview-limit 10"`,
        `- flag="low-title-query-overlap" topGroups=1 pendingInTopGroups=1 topGroup="creatine-lifespan creatine ClinicalTrials.gov AU" caution="${LOW_TITLE_OVERLAP_CAUTION}" list="--candidates --candidate-claim-id creatine-lifespan --candidate-intervention-id creatine --candidate-region AU --candidate-source clinical-trials --candidates-limit 1" packet="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan")}" siblings="--candidate-siblings ${safeCandidateKey("clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan")}" curationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan")}" flags="--candidate-review-flags --candidate-review-flag low-title-query-overlap --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag low-title-query-overlap --candidate-claim-id creatine-lifespan --candidate-intervention-id creatine --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" overview="--candidate-review-overview --candidate-review-overview-limit 10"`,
        "Source-candidate read-only next commands",
        'reviewOverview="--candidate-review-overview --candidate-review-overview-limit 10"',
        'reviewFlags="--candidate-review-flags --candidate-review-flags-limit 10"',
        'duplicates="--candidates --candidate-duplicates"',
        'queuedJobs="--jobs --jobs-status queued"',
        'curationHandoff="--candidate-curation-handoff"'
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
    const listSiblings = vi.fn().mockResolvedValue(
      sourceCandidateSiblings({
        target: sourceCandidate({
          dedupeKey: "pubmed|au|creatine|28615996",
          source: "PubMed",
          externalId: "28615996"
        }),
        siblings: [
          {
            candidate: sourceCandidate({
              dedupeKey: "pubmed|au|creatine-aging|28615996",
              source: "PubMed",
              externalId: "28615996"
            }),
            matchReasons: ["Same source/external id"]
          }
        ]
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCandidate, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCandidate).toHaveBeenCalledWith("pubmed|au|creatine|28615996");
    expect(listSiblings).toHaveBeenCalledWith("pubmed|au|creatine|28615996", {});
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate detail",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        "Source-candidate detail command hints",
        "safeReadOnly=true",
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-id creatine --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        "duplicateIdentityCandidates=2",
        'duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2"',
        `duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}"`,
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
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCandidate, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate detail",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        "Source-candidate detail command hints",
        "safeReadOnly=true",
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
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

  it("prints review cautions for broad or low-overlap claim-scoped detail", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const getCandidate = vi.fn().mockResolvedValue(
      sourceCandidate({
        dedupeKey: candidateKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        query: "Vitamin D safety adverse effects",
        title: "Calcium fracture prevention trial",
        url: "https://clinicaltrials.gov/study/NCT00715676",
        publishedYear: undefined,
        sourceType: "Clinical trial record",
        abstractAvailable: undefined,
        triageScore: 100,
        triageReasons: ["Matches query context"],
        interventionId: "vitamin-d",
        claimId: "vitamin-d-deficiency"
      })
    );
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-detail", candidateKey],
        { stdout },
        { getCandidate, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate detail",
        `dedupe="${candidateKey}"`,
        `key=${safeCandidateKey(candidateKey)}`,
        "Source-candidate detail command hints",
        "safeReadOnly=true",
        `packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}"`,
        `siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}"`,
        'groupList="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}"`,
        `curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}"`,
        'source="ClinicalTrials.gov"',
        'externalId="NCT00715676"',
        'region="AU"',
        'query="Vitamin D safety adverse effects"',
        'title="Calcium fracture prevention trial"',
        "url=https://clinicaltrials.gov/study/NCT00715676",
        "triage=100/100",
        'decision="Pending review"',
        'reviewStatus="Unreviewed AI draft"',
        'sourceType="Clinical trial record"',
        "intervention=vitamin-d",
        "claim=vitamin-d-deficiency",
        "triageReasons:",
        '  - "Matches query context"',
        'reviewFlags="broad-safety-query, low-title-query-overlap"',
        'flags="--candidate-review-flags --candidate-review-flags-limit 10"',
        'flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10"',
        "reviewCautions:",
        '  - "broad-safety-query: Broad safety/adverse query; verify title, population, outcomes, and source identity against the candidate claim."',
        '  - "low-title-query-overlap: Low title/query overlap; inspect the packet and siblings for off-claim or off-intervention matches."'
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

  it("prints a read-only source-candidate review packet", async () => {
    const stdout = vi.fn();
    const candidate = sourceCandidate({
      interventionId: "creatine",
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed"
    });
    const getCandidate = vi.fn().mockResolvedValue(candidate);
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate,
      references: [
        {
          id: "ref-creatine-position-stand",
          title: "Creatine position stand",
          source: "PubMed",
          identifier: "PMID: 28615996",
          year: 2017,
          url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
        }
      ]
    });
    const listSiblings = vi.fn().mockResolvedValue({
      target: candidate,
      siblings: [
        {
          candidate: sourceCandidate({
            dedupeKey: "pubmed|au|creatine-aging|28615996",
            query: "creatine aging",
            title: "Creatine duplicate",
            interventionId: "creatine",
            claimId: "creatine-aging"
          }),
          matchReasons: ["Same source/external id", "Same intervention context"]
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-review-packet", safeCandidateKey("pubmed|au|creatine|28615996")],
        { stdout },
        { getCandidate, listReferenceMatches, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCandidate).toHaveBeenCalledWith("pubmed|au|creatine|28615996");
    expect(listReferenceMatches).toHaveBeenCalledWith(
      "pubmed|au|creatine|28615996"
    );
    expect(listSiblings).toHaveBeenCalledWith("pubmed|au|creatine|28615996", {});
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review packet",
        [
          "Source-candidate review command hints",
          "safeReadOnly=true",
          `detail="--candidate-detail ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
          `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
          `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
          'groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-id creatine --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
          `curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
          `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
          "duplicateIdentityCandidates=2",
          'duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2"',
          `duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}"`,
          "humanReviewedWritesRequireOperator=true",
          "acceptRequiresMatchingCuratedReference=true",
          "acceptedReferenceMatches=1",
          "acceptReferenceReady=true",
          "reviewDecisionRequiresHumanNote=true",
          `acceptTemplate="--accept-candidate ${safeCandidateKey("pubmed|au|creatine|28615996")} --accepted-reference-id <reference-id> --review-note \\"Human-reviewed rationale.\\""`,
          `rejectTemplate="--reject-candidate ${safeCandidateKey("pubmed|au|creatine|28615996")} --review-note \\"Human-reviewed rationale.\\""`
        ].join("\n"),
        [
          "Source-candidate detail",
          'dedupe="pubmed|au|creatine|28615996"',
          `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
          'source="PubMed"',
          'externalId="28615996"',
          'region="AU"',
          'query="creatine strength"',
          'title="Creatine position stand"',
          "url=https://pubmed.ncbi.nlm.nih.gov/28615996/",
          "triage=80/100",
          'decision="Pending review"',
          'reviewStatus="Unreviewed AI draft"',
          "publishedYear=2017",
          'sourceType="Review"',
          "abstractAvailable=true",
          "intervention=creatine",
          "claim=creatine-strength",
          "ingestionJob=job-pubmed",
          "triageReasons:",
          '  - "Title matches query"'
        ].join("\n"),
        [
          `Source-candidate accepted-reference matches: total=1 dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} candidate="Creatine position stand" source="PubMed" externalId="28615996" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}" groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-id creatine --candidate-region AU --candidate-source pubmed --candidates-limit 10" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}" decision="Pending review" reviewStatus="Unreviewed AI draft"`,
          '- reference="ref-creatine-position-stand" source="PubMed" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ identifier="PMID: 28615996" year=2017'
        ].join("\n"),
        [
          `Source-candidate siblings: total=1 target="pubmed|au|creatine|28615996" targetKey=${safeCandidateKey("pubmed|au|creatine|28615996")} targetPacket="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}" targetReferenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}" targetCurationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}" targetCurationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}" duplicateIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" candidate="Creatine position stand" source="PubMed" externalId="28615996" query="creatine strength" region="AU" decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=creatine claim=creatine-strength`,
          `- match="Same source/external id, Same intervention context" triage=80/100 PubMed AU dedupe="pubmed|au|creatine-aging|28615996" key=${safeCandidateKey("pubmed|au|creatine-aging|28615996")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine-aging|28615996")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine-aging|28615996")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine-aging|28615996")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine-aging|28615996")}" externalId="28615996" query="creatine aging" title="Creatine duplicate" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=creatine claim=creatine-aging`
        ].join("\n")
      ].join("\n\n")
    );
  });

  it("omits duplicate command hints when review packet siblings do not share identity", async () => {
    const stdout = vi.fn();
    const candidate = sourceCandidate({
      dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
      interventionId: "creatine",
      claimId: "creatine-strength"
    });
    const getCandidate = vi.fn().mockResolvedValue(candidate);
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate,
      references: []
    });
    const listSiblings = vi.fn().mockResolvedValue({
      target: candidate,
      siblings: [
        {
          candidate: sourceCandidate({
            dedupeKey: "pubmed|au|creatine|30762623|creatine|creatine-strength",
            externalId: "30762623",
            interventionId: "creatine",
            claimId: "creatine-strength"
          }),
          matchReasons: ["Same query/region", "Same intervention context"]
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-review-packet",
          safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")
        ],
        { stdout },
        { getCandidate, listReferenceMatches, listSiblings }
      )
    ).resolves.toBe(0);

    const output = stdout.mock.calls[0]?.[0] ?? "";
    expect(output).toContain("Source-candidate review command hints");
    expect(output).toContain(
      `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}"`
    );
    expect(output).not.toContain("duplicates=");
  });

  it("prints review flag hints in flagged review packet command hints", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const candidate = sourceCandidate({
      dedupeKey: candidateKey,
      source: "ClinicalTrials.gov",
      externalId: "NCT00715676",
      query: "Vitamin D safety adverse effects",
      title: "Calcium fracture prevention trial",
      url: "https://clinicaltrials.gov/study/NCT00715676",
      interventionId: "vitamin-d",
      claimId: "vitamin-d-deficiency"
    });
    const getCandidate = vi.fn().mockResolvedValue(candidate);
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate,
      references: []
    });
    const listSiblings = vi.fn().mockResolvedValue({
      target: candidate,
      siblings: []
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-review-packet", candidateKey],
        { stdout },
        { getCandidate, listReferenceMatches, listSiblings }
      )
    ).resolves.toBe(0);

    const output = stdout.mock.calls[0]?.[0] ?? "";
    expect(output).toContain("Source-candidate review command hints");
    expect(output).toContain(
      'reviewFlags="--candidate-review-flags --candidate-review-flags-limit 10"'
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
        reviewedAt: "2026-06-02T03:00:00.000Z",
        reviewNote: "Matched PMID and claim context.",
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
      nextAction: "Review for public source packet inclusion.",
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
    const listSiblings = vi.fn().mockResolvedValue(
      sourceCandidateSiblings({
        target: sourceCandidate({
          dedupeKey: "pubmed|au|creatine|28615996",
          source: "PubMed",
          externalId: "28615996"
        }),
        siblings: [
          {
            candidate: sourceCandidate({
              dedupeKey: "pubmed|au|creatine-aging|28615996",
              source: "PubMed",
              externalId: "28615996"
            }),
            matchReasons: ["Same source/external id"]
          }
        ]
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationStatus, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCurationStatus).toHaveBeenCalledWith("pubmed|au|creatine|28615996");
    expect(listSiblings).toHaveBeenCalledWith("pubmed|au|creatine|28615996", {});
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Public source packet ready"',
        'nextAction="Review for public source packet inclusion."',
        "publicSourcePacketReady=true",
        'nextWrite="none"',
        "writeReady=false",
        "reviewed=2026-06-02T03:00:00.000Z",
        'note="Matched PMID and claim context."',
        "duplicateIdentityCandidates=2",
        'duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2"',
        `duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}"`,
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

  it("prints accepted-reference mismatch curation status", async () => {
    const stdout = vi.fn();
    const getCurationStatus = vi.fn().mockResolvedValue({
      acceptedReference: {
        id: "wrong-pubmed-reference",
        title: "Wrong PubMed reference",
        source: "PubMed",
        identifier: "PMID: 12345678",
        year: 2020,
        url: "https://pubmed.ncbi.nlm.nih.gov/12345678/"
      },
      acceptedReferenceId: "wrong-pubmed-reference",
      candidate: sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "wrong-pubmed-reference",
        claimId: "creatine-strength"
      }),
      claimLinks: [],
      nextAction:
        "Replace the accepted reference with one matching the candidate source and external id.",
      publicSourcePacketReady: false,
      status: "Accepted reference mismatch",
      studies: []
    });
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationStatus, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Accepted reference mismatch"',
        'nextAction="Replace the accepted reference with one matching the candidate source and external id."',
        "publicSourcePacketReady=false",
        'nextWrite="claimLink"',
        "writeReady=false",
        'blockedUntil="Accepted candidate reference must match candidate source and external id."',
        `writeReview="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        "acceptedReference=wrong-pubmed-reference",
        'acceptedReferenceTitle="Wrong PubMed reference"',
        "acceptedReferenceUrl=https://pubmed.ncbi.nlm.nih.gov/12345678/",
        "candidateClaim=creatine-strength",
        "claimLinks=0",
        "studies=0"
      ].join("\n")
    );
  });

  it("prints review flags in read-only curation status", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const getCurationStatus = vi.fn().mockResolvedValue({
      acceptedReferenceId: "trial-nct00715676",
      candidate: sourceCandidate({
        dedupeKey: candidateKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        query: "Vitamin D safety adverse effects",
        title: "Calcium fracture prevention trial",
        url: "https://clinicaltrials.gov/study/NCT00715676",
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "trial-nct00715676",
        interventionId: "vitamin-d",
        claimId: "vitamin-d-deficiency"
      }),
      claimLinks: [],
      nextAction: "Attach or restore the matching curated reference before public packet review.",
      publicSourcePacketReady: false,
      status: "Accepted reference missing",
      studies: []
    });
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", candidateKey],
        { stdout },
        { getCurationStatus, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        `dedupe="${candidateKey}"`,
        `key=${safeCandidateKey(candidateKey)}`,
        `packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}"`,
        `siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}"`,
        'groupList="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10"',
        `curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}"`,
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Accepted reference missing"',
        'nextAction="Attach or restore the matching curated reference before public packet review."',
        "publicSourcePacketReady=false",
        'nextWrite="claimLink"',
        "writeReady=false",
        'blockedUntil="Accepted candidate reference required before claim linking."',
        `writeReview="--candidate-curation-draft ${safeCandidateKey(candidateKey)}"`,
        'reviewFlags="broad-safety-query, low-title-query-overlap"',
        'flags="--candidate-review-flags --candidate-review-flags-limit 10"',
        'flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10"',
        `reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}"`,
        "acceptedReference=trial-nct00715676",
        "candidateClaim=vitamin-d-deficiency",
        "claimLinks=0",
        "studies=0"
      ].join("\n")
    );
  });

  it("prints read-only curation status for source candidates that are not accepted", async () => {
    const stdout = vi.fn();
    const getCurationStatus = vi.fn().mockResolvedValue({
      candidate: sourceCandidate(),
      claimLinks: [],
      nextAction: "Accept with a matching curated reference before curation handoff.",
      publicSourcePacketReady: false,
      status: "Not accepted",
      studies: []
    });
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-status", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationStatus, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation status",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'decision="Pending review"',
        'reviewStatus="Unreviewed AI draft"',
        'status="Not accepted"',
        'nextAction="Accept with a matching curated reference before curation handoff."',
        "publicSourcePacketReady=false",
        'nextWrite="reviewDecision"',
        "writeReady=false",
        'blockedUntil="Accepted candidate review decision required before curation writes."',
        "acceptRequiresMatchingCuratedReference=true",
        "reviewDecisionRequiresHumanNote=true",
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

  it("prints a read-only curation draft for accepted candidates", async () => {
    const stdout = vi.fn();
    const candidateKey = "pubmed|au|creatine|28615996";
    const safeKey = safeCandidateKey(candidateKey);
    const getCurationDraft = vi.fn().mockResolvedValue({
      claimLinkDraft: {
        alreadyLinked: false,
        claimId: "creatine-strength",
        note: "Accepted PubMed candidate 28615996: Creatine position stand",
        referenceId: "ref-creatine-position-stand",
        relevance: 5
      },
      status: {
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
          reviewedAt: "2026-06-02T03:00:00.000Z",
          reviewNote: "Matched PMID and claim context.",
          claimId: "creatine-strength"
        }),
        candidateClaimLinked: false,
        claimLinks: [],
        nextAction:
          "Link the accepted reference to the candidate claim before public packet review.",
        publicSourcePacketReady: false,
        status: "Claim link missing",
        studies: []
      },
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
            label: "publicationTypes",
            value: "Journal Article, Review"
          }
        ],
        pmid: "28615996",
        referenceId: "ref-creatine-position-stand",
        source: "PubMed",
        sourceTypeSuggestion: "SYSTEMATIC_REVIEW",
        title: "Creatine position stand",
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
        year: 2017
      }
    });
    const listSiblings = vi.fn().mockResolvedValue(
      sourceCandidateSiblings({
        target: sourceCandidate({
          dedupeKey: "pubmed|au|creatine|28615996",
          source: "PubMed",
          externalId: "28615996"
        }),
        siblings: [
          {
            candidate: sourceCandidate({
              dedupeKey: "pubmed|au|creatine-aging|28615996",
              source: "PubMed",
              externalId: "28615996"
            }),
            matchReasons: ["Same source/external id"]
          }
        ]
      })
    );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-draft", candidateKey],
        { stdout },
        { getCurationDraft, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(getCurationDraft).toHaveBeenCalledWith(candidateKey);
    expect(listSiblings).toHaveBeenCalledWith(candidateKey, {});
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation draft",
        "readOnly=true",
        `dedupe="${candidateKey}"`,
        `key=${safeKey}`,
        `packet="--candidate-review-packet ${safeKey}"`,
        `referenceMatches="--candidate-reference-matches ${safeKey}"`,
        `siblings="--candidate-siblings ${safeKey}"`,
        'groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeKey}"`,
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Claim link missing"',
        'nextAction="Link the accepted reference to the candidate claim before public packet review."',
        "publicSourcePacketReady=false",
        "reviewed=2026-06-02T03:00:00.000Z",
        'note="Matched PMID and claim context."',
        "duplicateIdentityCandidates=2",
        'duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2"',
        `duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}"`,
        "acceptedReference=ref-creatine-position-stand",
        'acceptedReferenceTitle="Creatine position stand"',
        "acceptedReferenceUrl=https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "candidateClaim=creatine-strength",
        "candidateClaimLinked=false",
        "claimLinkDraft:",
        "  reference=ref-creatine-position-stand",
        "  claim=creatine-strength",
        "  relevance=5",
        "  alreadyLinked=false",
        "  writeReady=true",
        '  note="Accepted PubMed candidate 28615996: Creatine position stand"',
        `  commandTemplate=${JSON.stringify(
          `--link-candidate-claim ${safeKey} --claim-link-relevance 5 --claim-link-note "Human-reviewed claim-link rationale."`
        )}`,
        "studyExtractionDraft:",
        "  reference=ref-creatine-position-stand",
        '  title="Creatine position stand"',
        '  source="PubMed"',
        '  sourceTypeSuggestion="SYSTEMATIC_REVIEW"',
        "  alreadyExtracted=false",
        "  claimLinkRequired=true",
        "  writeReady=false",
        '  blockedUntil="Claim link required before study extraction."',
        "  url=https://pubmed.ncbi.nlm.nih.gov/28615996/",
        "  year=2017",
        "  pmid=28615996",
        '  doi="10.1186/s12970-017-0173-z"',
        "  abstractAvailable=true",
        '  manualFields="sampleSize, population, interventionName, outcomes, adverseEvents, fundingConflicts, riskOfBias"',
        `  commandTemplate=${JSON.stringify(
          [
            `--extract-candidate-study ${safeKey}`,
            "--study-source-type systematic-review",
            '--study-sample-size "Human-entered sample size."',
            '--study-population "Human-reviewed population."',
            '--study-intervention-name "Human-reviewed intervention."',
            '--study-outcome "Human-reviewed outcome."',
            '--study-adverse-events "Human-reviewed adverse event summary."',
            '--study-funding-conflicts "Human-reviewed funding/conflict note."',
            '--study-risk-of-bias "Human-reviewed risk-of-bias assessment."'
          ].join(" ")
        )}`,
        "  metadataFields:",
        '    journal="Journal of the International Society of Sports Nutrition"',
        '    publicationTypes="Journal Article, Review"'
      ].join("\n")
    );
  });

  it("prints curation draft blockers without draft fields", async () => {
    const stdout = vi.fn();
    const getCurationDraft = vi.fn().mockResolvedValue({
      status: {
        candidate: sourceCandidate(),
        claimLinks: [],
        nextAction: "Accept with a matching curated reference before curation handoff.",
        publicSourcePacketReady: false,
        status: "Not accepted",
        studies: []
      }
    });
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-draft", "pubmed|au|creatine|28615996"],
        { stdout },
        { getCurationDraft, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation draft",
        "readOnly=true",
        'dedupe="pubmed|au|creatine|28615996"',
        `key=${safeCandidateKey("pubmed|au|creatine|28615996")}`,
        `packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        `siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}"`,
        'decision="Pending review"',
        'reviewStatus="Unreviewed AI draft"',
        'status="Not accepted"',
        'nextAction="Accept with a matching curated reference before curation handoff."',
        "publicSourcePacketReady=false",
        "acceptRequiresMatchingCuratedReference=true",
        "reviewDecisionRequiresHumanNote=true",
        "claimLinkDraft: unavailable",
        "studyExtractionDraft: unavailable"
      ].join("\n")
    );
  });

  it("prints review flags in read-only curation draft", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const getCurationDraft = vi.fn().mockResolvedValue({
      status: {
        acceptedReferenceId: "trial-nct00715676",
        candidate: sourceCandidate({
          dedupeKey: candidateKey,
          source: "ClinicalTrials.gov",
          externalId: "NCT00715676",
          query: "Vitamin D safety adverse effects",
          title: "Calcium fracture prevention trial",
          url: "https://clinicaltrials.gov/study/NCT00715676",
          decision: "Accepted",
          reviewStatus: "Human reviewed",
          acceptedReferenceId: "trial-nct00715676",
          interventionId: "vitamin-d",
          claimId: "vitamin-d-deficiency"
        }),
        claimLinks: [],
        nextAction:
          "Attach or restore the matching curated reference before public packet review.",
        publicSourcePacketReady: false,
        status: "Accepted reference missing",
        studies: []
      }
    });
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-draft", candidateKey],
        { stdout },
        { getCurationDraft, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation draft",
        "readOnly=true",
        `dedupe="${candidateKey}"`,
        `key=${safeCandidateKey(candidateKey)}`,
        `packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}"`,
        `referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}"`,
        `siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}"`,
        'groupList="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10"',
        `curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}"`,
        'decision="Accepted"',
        'reviewStatus="Human reviewed"',
        'status="Accepted reference missing"',
        'nextAction="Attach or restore the matching curated reference before public packet review."',
        "publicSourcePacketReady=false",
        'reviewFlags="broad-safety-query, low-title-query-overlap"',
        'flags="--candidate-review-flags --candidate-review-flags-limit 10"',
        'flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10"',
        `reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}"`,
        "acceptedReference=trial-nct00715676",
        "candidateClaim=vitamin-d-deficiency",
        "claimLinkDraft: unavailable",
        "studyExtractionDraft: unavailable"
      ].join("\n")
    );
  });

  it("returns a failing exit code when curation draft targets a missing candidate", async () => {
    const stderr = vi.fn();
    const getCurationDraft = vi.fn().mockResolvedValue(null);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-draft", "missing-candidate"],
        { stderr },
        { getCurationDraft, runNextJob }
      )
    ).resolves.toBe(1);

    expect(getCurationDraft).toHaveBeenCalledWith("missing-candidate");
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Source candidate not found: "missing-candidate"'
    );
  });

  it("prints read-only source-candidate curation handoff rows", async () => {
    const stdout = vi.fn();
    const listCurationHandoff = vi.fn().mockResolvedValue([
      {
        acceptedReferenceId: "ref-creatine-position-stand",
        candidate: sourceCandidate({
          decision: "Accepted",
          reviewStatus: "Human reviewed",
          acceptedReferenceId: "ref-creatine-position-stand",
          reviewedAt: "2026-06-02T03:00:00.000Z",
          reviewNote: "Matched PMID and claim context.",
          claimId: "creatine-strength"
        }),
        candidateClaimLinked: true,
        claimLinks: [
          {
            claimId: "creatine-strength",
            relevance: 5
          }
        ],
        nextAction: "Add structured study extraction for the accepted reference.",
        publicSourcePacketReady: false,
        status: "Extraction pending",
        studies: []
      },
      {
        acceptedReferenceId: "trial-nct123",
        candidate: sourceCandidate({
          dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
          source: "ClinicalTrials.gov",
          externalId: "NCT123",
          title: "Creatine and aging",
          url: "https://clinicaltrials.gov/study/NCT123",
          decision: "Accepted",
          reviewStatus: "Human reviewed",
          acceptedReferenceId: "trial-nct123",
          reviewedAt: "2026-06-02T04:00:00.000Z",
          reviewNote: "Needs claim link before promotion.",
          claimId: "creatine-aging"
        }),
        candidateClaimLinked: false,
        claimLinks: [],
        nextAction:
          "Link the accepted reference to the candidate claim before public packet review.",
        publicSourcePacketReady: false,
        status: "Claim link missing",
        studies: [
          {
            id: "study-trial-nct123",
            referenceId: "trial-nct123",
            title: "Creatine and aging extraction"
          }
        ]
      }
    ]);
    const listSiblings = vi
      .fn()
      .mockResolvedValueOnce(
        sourceCandidateSiblings({
          target: sourceCandidate({
            dedupeKey: "pubmed|au|creatine|28615996",
            source: "PubMed",
            externalId: "28615996"
          }),
          siblings: [
            {
              candidate: sourceCandidate({
                dedupeKey: "pubmed|au|creatine-aging|28615996",
                source: "PubMed",
                externalId: "28615996"
              }),
              matchReasons: ["Same source/external id"]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        sourceCandidateSiblings({
          target: sourceCandidate({
            dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
            source: "ClinicalTrials.gov",
            externalId: "NCT123"
          }),
          siblings: []
        })
      );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-curation-handoff",
          "--candidate-curation-handoff-limit",
          "2",
          "--candidate-source",
          "pubmed",
          "--candidate-job-id",
          "job-pubmed",
          "--candidate-intervention-id",
          "creatine",
          "--candidate-claim-id",
          "creatine-strength",
          "--candidate-curation-handoff-status",
          "extraction-pending"
        ],
        { stdout },
        { listCurationHandoff, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCurationHandoff).toHaveBeenCalledWith({
      claimId: "creatine-strength",
      ingestionJobId: "job-pubmed",
      interventionId: "creatine",
      limit: 2,
      region: undefined,
      source: "PubMed",
      status: "Extraction pending"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(listSiblings).toHaveBeenCalledWith("pubmed|au|creatine|28615996", {});
    expect(listSiblings).toHaveBeenCalledWith(
      "clinicaltrials.gov|au|creatine|nct123",
      {}
    );
    const creatineKey = safeCandidateKey("pubmed|au|creatine|28615996");
    const agingKey = safeCandidateKey("clinicaltrials.gov|au|creatine|nct123");

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation handoff: total=2",
        `- status="Extraction pending" nextAction="Add structured study extraction for the accepted reference." publicSourcePacketReady=false nextWrite="studyExtraction" writeReady=true writeReview="--candidate-curation-draft ${creatineKey}" PubMed AU dedupe="pubmed|au|creatine|28615996" key=${creatineKey} packet="--candidate-review-packet ${creatineKey}" referenceMatches="--candidate-reference-matches ${creatineKey}" siblings="--candidate-siblings ${creatineKey}" curationStatus="--candidate-curation-status ${creatineKey}" curationDraft="--candidate-curation-draft ${creatineKey}" title="Creatine position stand" duplicateIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" acceptedReference=ref-creatine-position-stand reviewed=2026-06-02T03:00:00.000Z note="Matched PMID and claim context." candidateClaim=creatine-strength candidateClaimLinked=true claimLinks=1 studies=0`,
        `- status="Claim link missing" nextAction="Link the accepted reference to the candidate claim before public packet review." publicSourcePacketReady=false nextWrite="claimLink" writeReady=true writeReview="--candidate-curation-draft ${agingKey}" ClinicalTrials.gov AU dedupe="clinicaltrials.gov|au|creatine|nct123" key=${agingKey} packet="--candidate-review-packet ${agingKey}" referenceMatches="--candidate-reference-matches ${agingKey}" siblings="--candidate-siblings ${agingKey}" curationStatus="--candidate-curation-status ${agingKey}" curationDraft="--candidate-curation-draft ${agingKey}" title="Creatine and aging" acceptedReference=trial-nct123 reviewed=2026-06-02T04:00:00.000Z note="Needs claim link before promotion." candidateClaim=creatine-aging candidateClaimLinked=false claimLinks=0 studies=1`
      ].join("\n")
    );
  });

  it("prints an empty source-candidate curation handoff list", async () => {
    const stdout = vi.fn();
    const listCurationHandoff = vi.fn().mockResolvedValue([]);

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-handoff"],
        { stdout },
        { listCurationHandoff }
      )
    ).resolves.toBe(0);

    expect(listCurationHandoff).toHaveBeenCalledWith({
      claimId: undefined,
      ingestionJobId: undefined,
      interventionId: undefined,
      region: undefined,
      source: undefined,
      status: undefined,
      limit: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      "Source-candidate curation handoff: total=0"
    );
  });

  it("prints review flags in curation handoff rows", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const listCurationHandoff = vi.fn().mockResolvedValue([
      {
        acceptedReferenceId: "trial-nct00715676",
        candidate: sourceCandidate({
          dedupeKey: candidateKey,
          source: "ClinicalTrials.gov",
          externalId: "NCT00715676",
          query: "Vitamin D safety adverse effects",
          title: "Calcium fracture prevention trial",
          url: "https://clinicaltrials.gov/study/NCT00715676",
          decision: "Accepted",
          reviewStatus: "Human reviewed",
          acceptedReferenceId: "trial-nct00715676",
          interventionId: "vitamin-d",
          claimId: "vitamin-d-deficiency"
        }),
        claimLinks: [],
        nextAction:
          "Attach or restore the matching curated reference before public packet review.",
        publicSourcePacketReady: false,
        status: "Accepted reference missing",
        studies: []
      }
    ]);
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-curation-handoff"],
        { stdout },
        { listCurationHandoff, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate curation handoff: total=1",
        `- status="Accepted reference missing" nextAction="Attach or restore the matching curated reference before public packet review." publicSourcePacketReady=false nextWrite="claimLink" writeReady=false blockedUntil="Accepted candidate reference required before claim linking." writeReview="--candidate-curation-draft ${safeCandidateKey(candidateKey)}" ClinicalTrials.gov AU dedupe="${candidateKey}" key=${safeCandidateKey(candidateKey)} packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}" siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}" title="Calcium fracture prevention trial" reviewFlags="broad-safety-query, low-title-query-overlap" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" acceptedReference=trial-nct00715676 candidateClaim=vitamin-d-deficiency claimLinks=0 studies=0`
      ].join("\n")
    );
  });

  it("prints read-only source-candidate accepted-reference matches", async () => {
    const stdout = vi.fn();
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate: sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996",
        source: "PubMed",
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-existing"
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
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996",
        source: "PubMed",
        externalId: "28615996"
      }),
      siblings: [
        {
          candidate: sourceCandidate({
            dedupeKey: "pubmed|au|creatine-aging|28615996",
            source: "PubMed",
            externalId: "28615996"
          }),
          matchReasons: ["Same source/external id"]
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "pubmed|au|creatine|28615996"],
        { stdout },
        { listReferenceMatches, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listReferenceMatches).toHaveBeenCalledWith(
      "pubmed|au|creatine|28615996"
    );
    expect(listSiblings).toHaveBeenCalledWith("pubmed|au|creatine|28615996", {});
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        `Source-candidate accepted-reference matches: total=2 dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} candidate="Creatine position stand" source="PubMed" externalId="28615996" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}" groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}" decision="Accepted" reviewStatus="Human reviewed" duplicateIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" acceptedReference=ref-existing`,
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
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/NCT123",
        decision: "Accepted",
        reviewStatus: "Human reviewed"
      }),
      references: []
    });
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov",
        externalId: "NCT123"
      }),
      siblings: []
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "clinicaltrials.gov|au|creatine|nct123"],
        { stdout },
        { listReferenceMatches, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        `Source-candidate accepted-reference matches: total=0 dedupe="clinicaltrials.gov|au|creatine|nct123" key=${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")} candidate="Creatine and aging" source="ClinicalTrials.gov" externalId="NCT123" url=https://clinicaltrials.gov/study/NCT123 packet="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" siblings="--candidate-siblings ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" curationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" decision="Accepted" reviewStatus="Human reviewed"`,
        '- referenceDraft="ref-clinicaltrials-gov-nct123" source="ClinicalTrials.gov" identifier="NCT123" title="Creatine and aging" url=https://clinicaltrials.gov/study/NCT123 note="Draft only; verify before adding a curated reference." year=2017'
      ].join("\n")
    );
  });

  it("prints review flags in accepted-reference match headings", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const listReferenceMatches = vi.fn().mockResolvedValue({
      candidate: sourceCandidate({
        dedupeKey: candidateKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        query: "Vitamin D safety adverse effects",
        title: "Calcium fracture prevention trial",
        url: "https://clinicaltrials.gov/study/NCT00715676",
        interventionId: "vitamin-d",
        claimId: "vitamin-d-deficiency"
      }),
      references: []
    });
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: candidateKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676"
      }),
      siblings: []
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", candidateKey],
        { stdout },
        { listReferenceMatches, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        `Source-candidate accepted-reference matches: total=0 dedupe="${candidateKey}" key=${safeCandidateKey(candidateKey)} candidate="Calcium fracture prevention trial" source="ClinicalTrials.gov" externalId="NCT00715676" url=https://clinicaltrials.gov/study/NCT00715676 packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}" siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}" groupList="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}" decision="Pending review" reviewStatus="Unreviewed AI draft" reviewFlags="broad-safety-query, low-title-query-overlap" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}"`,
        '- referenceDraft="ref-clinicaltrials-gov-nct00715676" source="ClinicalTrials.gov" identifier="NCT00715676" title="Calcium fracture prevention trial" url=https://clinicaltrials.gov/study/NCT00715676 note="Draft only; verify before adding a curated reference." year=2017'
      ].join("\n")
    );
  });

  it("returns a failing exit code when reference matches target a missing candidate", async () => {
    const stderr = vi.fn();
    const listReferenceMatches = vi.fn().mockResolvedValue(null);
    const listSiblings = vi.fn();
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-reference-matches", "missing-candidate"],
        { stderr },
        { listReferenceMatches, listSiblings, runNextJob }
      )
    ).resolves.toBe(1);

    expect(listReferenceMatches).toHaveBeenCalledWith("missing-candidate");
    expect(listSiblings).not.toHaveBeenCalled();
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'Source candidate not found: "missing-candidate"'
    );
  });

  it("prints read-only same-identity source-candidate siblings", async () => {
    const stdout = vi.fn();
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }),
      siblings: [
        {
          candidate: sourceCandidate({
            dedupeKey: "pubmed|au|creatine-aging|28615996|creatine|aging",
            externalId: "28615996",
            query: "creatine aging",
            title: "Creatine position stand duplicate",
            interventionId: "creatine",
            claimId: "creatine-aging"
          }),
          matchReasons: ["Same source/external id", "Same intervention context"]
        },
        {
          candidate: sourceCandidate({
            dedupeKey: "pubmed|au|creatine|999999|creatine|creatine-strength",
            externalId: "999999",
            query: "creatine strength",
            title: "Creatine strength companion",
            decision: "Rejected",
            reviewStatus: "Human reviewed",
            reviewedAt: "2026-06-02T04:00:00.000Z",
            reviewNote: "Wrong population.",
            interventionId: "creatine",
            claimId: "creatine-strength"
          }),
          matchReasons: [
            "Same query/region",
            "Same intervention context",
            "Same claim context"
          ]
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-siblings",
          "pubmed|au|creatine|28615996|creatine|creatine-strength",
          "--candidate-siblings-limit",
          "2"
        ],
        { stdout },
        { listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listSiblings).toHaveBeenCalledWith(
      "pubmed|au|creatine|28615996|creatine|creatine-strength",
      { limit: 2 }
    );
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        `Source-candidate siblings: total=2 target="pubmed|au|creatine|28615996|creatine|creatine-strength" targetKey=${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")} targetPacket="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" targetReferenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" targetCurationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" targetCurationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" duplicateIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" candidate="Creatine position stand" source="PubMed" externalId="28615996" query="creatine strength" region="AU" decision="Accepted" reviewStatus="Human reviewed" intervention=creatine claim=creatine-strength acceptedReference=ref-creatine-position-stand`,
        `- match="Same source/external id, Same intervention context" triage=80/100 PubMed AU dedupe="pubmed|au|creatine-aging|28615996|creatine|aging" key=${safeCandidateKey("pubmed|au|creatine-aging|28615996|creatine|aging")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine-aging|28615996|creatine|aging")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine-aging|28615996|creatine|aging")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine-aging|28615996|creatine|aging")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine-aging|28615996|creatine|aging")}" externalId="28615996" query="creatine aging" title="Creatine position stand duplicate" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=creatine claim=creatine-aging`,
        `- match="Same query/region, Same intervention context, Same claim context" triage=80/100 PubMed AU dedupe="pubmed|au|creatine|999999|creatine|creatine-strength" key=${safeCandidateKey("pubmed|au|creatine|999999|creatine|creatine-strength")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|999999|creatine|creatine-strength")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|999999|creatine|creatine-strength")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|999999|creatine|creatine-strength")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|999999|creatine|creatine-strength")}" externalId="999999" query="creatine strength" title="Creatine strength companion" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ decision="Rejected" reviewStatus="Human reviewed" reviewed=2026-06-02T04:00:00.000Z note="Wrong population." intervention=creatine claim=creatine-strength`
      ].join("\n")
    );
  });

  it("prints an empty same-identity source-candidate sibling list", async () => {
    const stdout = vi.fn();
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        query: "creatine aging",
        title: "Creatine and aging",
        url: "https://clinicaltrials.gov/study/NCT123"
      }),
      siblings: []
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-siblings", "clinicaltrials.gov|au|creatine|nct123"],
        { stdout },
        { listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      `Source-candidate siblings: total=0 target="clinicaltrials.gov|au|creatine|nct123" targetKey=${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")} targetPacket="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" targetReferenceMatches="--candidate-reference-matches ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" targetCurationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" targetCurationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" candidate="Creatine and aging" source="ClinicalTrials.gov" externalId="NCT123" query="creatine aging" region="AU" decision="Pending review" reviewStatus="Unreviewed AI draft"`
    );
  });

  it("prints review flags in source-candidate sibling context", async () => {
    const stdout = vi.fn();
    const targetKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const siblingKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00706004|vitamin-d|vitamin-d-deficiency";
    const listSiblings = vi.fn().mockResolvedValue({
      target: sourceCandidate({
        dedupeKey: targetKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        query: "Vitamin D safety adverse effects",
        title: "Phase 2 Safety and Efficacy Study of a Vitamin D Compound",
        url: "https://clinicaltrials.gov/study/NCT00715676",
        interventionId: "vitamin-d",
        claimId: "vitamin-d-deficiency"
      }),
      siblings: [
        {
          candidate: sourceCandidate({
            dedupeKey: siblingKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00706004",
            query: "Vitamin D safety adverse effects",
            title: "Calcium fracture prevention trial",
            url: "https://clinicaltrials.gov/study/NCT00706004",
            triageScore: 95,
            interventionId: "vitamin-d",
            claimId: "vitamin-d-deficiency"
          }),
          matchReasons: [
            "Same query/region",
            "Same intervention context",
            "Same claim context"
          ]
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-siblings", targetKey],
        { stdout },
        { listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        `Source-candidate siblings: total=1 target="${targetKey}" targetKey=${safeCandidateKey(targetKey)} targetPacket="--candidate-review-packet ${safeCandidateKey(targetKey)}" targetReferenceMatches="--candidate-reference-matches ${safeCandidateKey(targetKey)}" targetCurationStatus="--candidate-curation-status ${safeCandidateKey(targetKey)}" targetCurationDraft="--candidate-curation-draft ${safeCandidateKey(targetKey)}" candidate="Phase 2 Safety and Efficacy Study of a Vitamin D Compound" source="ClinicalTrials.gov" externalId="NCT00715676" query="Vitamin D safety adverse effects" region="AU" decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=vitamin-d claim=vitamin-d-deficiency targetReviewFlags="broad-safety-query" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" targetReviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION}"`,
        `- match="Same query/region, Same intervention context, Same claim context" triage=95/100 ClinicalTrials.gov AU dedupe="${siblingKey}" key=${safeCandidateKey(siblingKey)} packet="--candidate-review-packet ${safeCandidateKey(siblingKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(siblingKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(siblingKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(siblingKey)}" externalId="NCT00706004" query="Vitamin D safety adverse effects" title="Calcium fracture prevention trial" url=https://clinicaltrials.gov/study/NCT00706004 decision="Pending review" reviewStatus="Unreviewed AI draft" reviewFlags="broad-safety-query, low-title-query-overlap" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" intervention=vitamin-d claim=vitamin-d-deficiency`
      ].join("\n")
    );
  });

  it("returns a failing exit code when sibling lookup targets a missing candidate", async () => {
    const stderr = vi.fn();
    const listSiblings = vi.fn().mockResolvedValue(null);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-siblings", "missing-candidate"],
        { stderr },
        { listSiblings, runNextJob }
      )
    ).resolves.toBe(1);

    expect(listSiblings).toHaveBeenCalledWith("missing-candidate", {
      limit: undefined
    });
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
      `[Accepted] source-candidate PubMed AU dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} externalId="28615996" title="Creatine position stand" reviewStatus="Human reviewed" acceptedReference=ref-creatine-position-stand note="Full-text reviewed."`
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
      `[Rejected] source-candidate ClinicalTrials.gov AU dedupe="clinicaltrials.gov|au|creatine|nct123" key=${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")} externalId="NCT123" title="Creatine and aging" reviewStatus="Human reviewed" note="Not relevant to the consumer claim."`
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
          "ref-creatine-position-stand",
          "--review-note",
          "Full-text reviewed."
        ],
        { stderr },
        { recordDecision }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith(
      "Accepted source candidates require an acceptedReferenceId."
    );
  });

  it("links an accepted source candidate reference to its claim", async () => {
    const stdout = vi.fn();
    const linkCandidateClaim = vi.fn().mockResolvedValue({
      acceptedReference: {
        id: "ref-creatine-position-stand",
        title: "Creatine position stand",
        source: "PubMed",
        identifier: "PMID: 28615996",
        year: 2017,
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
      },
      candidate: sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength"
      }),
      claimLink: {
        claimId: "creatine-strength",
        note: "Primary source for this claim.",
        relevance: 4
      },
      created: true,
      status: {
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
            note: "Primary source for this claim.",
            relevance: 4
          }
        ],
        nextAction: "Add structured study extraction for the accepted reference.",
        publicSourcePacketReady: false,
        status: "Extraction pending",
        studies: []
      }
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--link-candidate-claim",
          "pubmed|au|creatine|28615996",
          "--claim-link-note",
          "Primary source for this claim.",
          "--claim-link-relevance",
          "4"
        ],
        { stdout },
        { linkCandidateClaim, runNextJob }
      )
    ).resolves.toBe(0);

    expect(linkCandidateClaim).toHaveBeenCalledWith({
      dedupeKey: "pubmed|au|creatine|28615996",
      note: "Primary source for this claim.",
      relevance: 4
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      `[CLAIM_LINKED] source-candidate PubMed AU dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} reference=ref-creatine-position-stand claim=creatine-strength created=true relevance=4 status="Extraction pending" publicSourcePacketReady=false nextAction="Add structured study extraction for the accepted reference." note="Primary source for this claim."`
    );
  });

  it("returns a failing exit code when claim linking fails", async () => {
    const stderr = vi.fn();
    const linkCandidateClaim = vi
      .fn()
      .mockRejectedValue(
        new Error("Accepted source candidate reference must match candidate source and external id.")
      );

    await expect(
      runSourceCandidateJobCommand(
        ["--link-candidate-claim", "pubmed|au|creatine|28615996"],
        { stderr },
        { linkCandidateClaim }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith(
      "Accepted source candidate reference must match candidate source and external id."
    );
  });

  it("extracts accepted source candidate study data without running jobs", async () => {
    const stdout = vi.fn();
    const extractCandidateStudy = vi.fn().mockResolvedValue({
      acceptedReference: {
        id: "ref-creatine-position-stand",
        title: "Creatine position stand",
        source: "PubMed",
        identifier: "PMID: 28615996",
        year: 2017,
        url: "https://pubmed.ncbi.nlm.nih.gov/28615996/"
      },
      candidate: sourceCandidate({
        decision: "Accepted",
        reviewStatus: "Human reviewed",
        acceptedReferenceId: "ref-creatine-position-stand",
        claimId: "creatine-strength"
      }),
      created: true,
      status: {
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
            note: "Primary source.",
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
      },
      study: {
        id: "study-creatine-issn",
        referenceId: "ref-creatine-position-stand",
        title: "Creatine position stand extraction",
        year: 2017
      }
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        studyCommandArgs([
          "--study-source-type",
          "systematic-review",
          "--study-dose",
          "3-5 g/day"
        ]),
        { stdout },
        { extractCandidateStudy, runNextJob }
      )
    ).resolves.toBe(0);

    expect(extractCandidateStudy).toHaveBeenCalledWith({
      abstract: undefined,
      adverseEvents: "No serious adverse events reported.",
      dedupeKey: "pubmed|au|creatine|28615996",
      dose: "3-5 g/day",
      duration: undefined,
      fundingConflicts: "Funding conflicts disclosed.",
      interventionName: "Creatine monohydrate",
      mainResults: undefined,
      outcomes: ["Strength", "Lean mass"],
      population: "Healthy adults",
      relevance: undefined,
      riskOfBias: "Moderate risk of bias.",
      sampleSize: "n=80",
      sourceType: "SYSTEMATIC_REVIEW",
      updateExisting: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      `[STUDY_EXTRACTED] source-candidate PubMed AU dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} reference=ref-creatine-position-stand study=study-creatine-issn created=true status="Public source packet ready" publicSourcePacketReady=true nextAction="Review for public source packet inclusion." title="Creatine position stand extraction" candidateClaim=creatine-strength year=2017`
    );
  });

  it("returns a failing exit code when study extraction fails", async () => {
    const stderr = vi.fn();
    const extractCandidateStudy = vi
      .fn()
      .mockRejectedValue(
        new Error("Accepted source candidate claim link is required before study extraction.")
      );

    await expect(
      runSourceCandidateJobCommand(
        studyCommandArgs(),
        { stderr },
        { extractCandidateStudy }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith(
      "Accepted source candidate claim link is required before study extraction."
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
        ingestionJobId: "job-pubmed",
        interventionId: "creatine",
        claimId: "creatine-strength"
      }),
      sourceCandidate({
        dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
        source: "ClinicalTrials.gov",
        externalId: "NCT123",
        region: "AU",
        title: "Creatine and aging",
        triageScore: 70,
        url: "https://clinicaltrials.gov/study/NCT123"
      })
    ]);
    const listSiblings = vi
      .fn()
      .mockResolvedValueOnce(
        sourceCandidateSiblings({
          target: sourceCandidate({
            dedupeKey: "pubmed|au|creatine|28615996|creatine|creatine-strength",
            source: "PubMed",
            externalId: "28615996"
          }),
          siblings: [
            {
              candidate: sourceCandidate({
                dedupeKey: "pubmed|au|creatine-aging|28615996",
                source: "PubMed",
                externalId: "28615996"
              }),
              matchReasons: ["Same source/external id"]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        sourceCandidateSiblings({
          target: sourceCandidate({
            dedupeKey: "clinicaltrials.gov|au|creatine|nct123",
            source: "ClinicalTrials.gov",
            externalId: "NCT123"
          }),
          siblings: []
        })
      );
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidates",
          "--candidates-limit",
          "2",
          "--candidate-source",
          "pubmed",
          "--candidate-external-id",
          "28615996",
          "--candidate-job-id",
          "job-pubmed",
          "--candidate-intervention-id",
          "creatine",
          "--candidate-claim-id",
          "creatine-strength"
        ],
        { stdout },
        { listCandidates, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: "creatine-strength",
      decision: undefined,
      externalId: "28615996",
      ingestionJobId: "job-pubmed",
      interventionId: "creatine",
      limit: 2,
      region: undefined,
      source: "PubMed"
    });
    expect(listSiblings).toHaveBeenCalledWith(
      "pubmed|au|creatine|28615996|creatine|creatine-strength",
      {}
    );
    expect(listSiblings).toHaveBeenCalledWith(
      "clinicaltrials.gov|au|creatine|nct123",
      {}
    );
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review queue: total=2",
        `- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996|creatine|creatine-strength" key=${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996|creatine|creatine-strength")}" duplicateIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 28615996 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" externalId="28615996" query="creatine strength" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ ingestionJob=job-pubmed intervention=creatine claim=creatine-strength`,
        `- triage=70/100 ClinicalTrials.gov AU dedupe="clinicaltrials.gov|au|creatine|nct123" key=${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")} packet="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" siblings="--candidate-siblings ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" curationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|creatine|nct123")}" externalId="NCT123" query="creatine strength" title="Creatine and aging" url=https://clinicaltrials.gov/study/NCT123`
      ].join("\n")
    );
  });

  it("passes missing claim and intervention filters to read-only candidate lists", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([]);

    await expect(
      runSourceCandidateJobCommand(
        ["--candidates", "--candidate-claim-missing", "--candidate-intervention-missing"],
        { stdout },
        { listCandidates }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        claimIdMissing: true,
        interventionIdMissing: true
      })
    );
    expect(stdout).toHaveBeenCalledWith("Source-candidate review queue: total=0");
  });

  it("prints duplicate source-candidate identity groups without running jobs", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn();
    const listIdentityGroups = vi.fn().mockResolvedValue([
      {
        source: "PubMed",
        externalId: "42141930",
        candidates: [
          sourceCandidate({
            dedupeKey: "pubmed|au|creatine-meta|42141930||",
            externalId: "42141930",
            query: "creatine meta",
            title: "Creatine meta-analysis",
            ingestionJobId: "job-unscoped",
            interventionId: undefined,
            claimId: undefined
          }),
          sourceCandidate({
            dedupeKey:
              "pubmed|au|creatine-strength|42141930|creatine|creatine-strength",
            externalId: "42141930",
            query: "creatine strength",
            title: "Creatine meta-analysis",
            ingestionJobId: "job-claim",
            interventionId: "creatine",
            claimId: "creatine-strength",
            decision: "Accepted",
            reviewStatus: "Human reviewed",
            acceptedReferenceId: "ref-pubmed-42141930",
            reviewedAt: "2026-06-02T03:00:00.000Z",
            reviewNote: "Matched PMID and claim context."
          })
        ]
      }
    ]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidates",
          "--candidate-duplicates",
          "--candidate-source",
          "pubmed",
          "--candidate-external-id",
          "42141930",
          "--candidates-limit",
          "3"
        ],
        { stdout },
        { listCandidates, listIdentityGroups, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listIdentityGroups).toHaveBeenCalledWith({
      claimId: undefined,
      decision: undefined,
      externalId: "42141930",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: 3,
      region: undefined,
      source: "PubMed"
    });
    expect(listCandidates).not.toHaveBeenCalled();
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate duplicate identities: total=1",
        `- PubMed externalId="42141930" candidates=2 pending=1 accepted=1 rejected=0 identityList="--candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 42141930 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" title="Creatine meta-analysis"`,
        `  - triage=80/100 dedupe="pubmed|au|creatine-meta|42141930||" key=${safeCandidateKey("pubmed|au|creatine-meta|42141930||")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine-meta|42141930||")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine-meta|42141930||")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine-meta|42141930||")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine-meta|42141930||")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine-meta|42141930||")}" groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 10" query="creatine meta" decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=none claim=none ingestionJob=job-unscoped`,
        `  - triage=80/100 dedupe="pubmed|au|creatine-strength|42141930|creatine|creatine-strength" key=${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine-strength|42141930|creatine|creatine-strength")}" groupList="--candidates --candidate-claim-id creatine-strength --candidate-intervention-id creatine --candidate-region AU --candidate-source pubmed --candidates-limit 10" query="creatine strength" decision="Accepted" reviewStatus="Human reviewed" acceptedReference=ref-pubmed-42141930 reviewed=2026-06-02T03:00:00.000Z note="Matched PMID and claim context." intervention=creatine claim=creatine-strength ingestionJob=job-claim`
      ].join("\n")
    );
  });

  it("prints review flags in duplicate identity candidate rows", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn();
    const unscopedKey = "clinicaltrials.gov|au|vitamin-d|nct00715676||";
    const claimKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const listIdentityGroups = vi.fn().mockResolvedValue([
      {
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        candidates: [
          sourceCandidate({
            dedupeKey: unscopedKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D",
            title: "Phase 2 Safety and Efficacy Study of a Vitamin D Compound",
            ingestionJobId: "job-unscoped",
            interventionId: undefined,
            claimId: undefined
          }),
          sourceCandidate({
            dedupeKey: claimKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D safety adverse effects",
            title: "Calcium fracture prevention trial",
            ingestionJobId: "job-claim",
            interventionId: "vitamin-d",
            claimId: "vitamin-d-deficiency"
          })
        ]
      }
    ]);

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidates",
          "--candidate-duplicates",
          "--candidate-source",
          "clinical-trials",
          "--candidate-external-id",
          "NCT00715676",
          "--candidates-limit",
          "2"
        ],
        { stdout },
        { listCandidates, listIdentityGroups }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate duplicate identities: total=1",
        `- ClinicalTrials.gov externalId="NCT00715676" candidates=2 pending=2 accepted=0 rejected=0 identityList="--candidates --candidate-duplicates --candidate-source clinical-trials --candidate-external-id NCT00715676 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" title="Phase 2 Safety and Efficacy Study of a Vitamin D Compound"`,
        `  - triage=80/100 dedupe="${unscopedKey}" key=${safeCandidateKey(unscopedKey)} packet="--candidate-review-packet ${safeCandidateKey(unscopedKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(unscopedKey)}" siblings="--candidate-siblings ${safeCandidateKey(unscopedKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(unscopedKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(unscopedKey)}" groupList="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" query="Vitamin D" decision="Pending review" reviewStatus="Unreviewed AI draft" intervention=none claim=none ingestionJob=job-unscoped`,
        `  - triage=80/100 dedupe="${claimKey}" key=${safeCandidateKey(claimKey)} packet="--candidate-review-packet ${safeCandidateKey(claimKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(claimKey)}" siblings="--candidate-siblings ${safeCandidateKey(claimKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(claimKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(claimKey)}" groupList="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" query="Vitamin D safety adverse effects" decision="Pending review" reviewStatus="Unreviewed AI draft" reviewFlags="broad-safety-query, low-title-query-overlap" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" intervention=vitamin-d claim=vitamin-d-deficiency ingestionJob=job-claim`
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
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());
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
        { listCandidates, listSiblings, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: undefined,
      decision: "Accepted",
      externalId: undefined,
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: 1,
      region: undefined,
      source: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        'Source-candidate review records: decision="Accepted": total=1',
        `- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996" key=${safeCandidateKey("pubmed|au|creatine|28615996")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996")}" externalId="28615996" query="creatine strength" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/ decision="Accepted" reviewStatus="Human reviewed" acceptedReference=ref-creatine-position-stand reviewed=2026-06-02T03:00:00.000Z note="Matched PMID and claim context." intervention=creatine claim=creatine-strength`
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

  it("prints compact review flags on source-candidate review rows", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const listCandidates = vi.fn().mockResolvedValue([
      sourceCandidate({
        dedupeKey: candidateKey,
        source: "ClinicalTrials.gov",
        externalId: "NCT00715676",
        query: "Vitamin D safety adverse effects",
        title: "Calcium fracture prevention trial",
        url: "https://clinicaltrials.gov/study/NCT00715676",
        triageScore: 100,
        interventionId: "vitamin-d",
        claimId: "vitamin-d-deficiency"
      })
    ]);
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidates"],
        { stdout },
        { listCandidates, listSiblings }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review queue: total=1",
        `- triage=100/100 ClinicalTrials.gov AU dedupe="${candidateKey}" key=${safeCandidateKey(candidateKey)} packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}" siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}" externalId="NCT00715676" query="Vitamin D safety adverse effects" title="Calcium fracture prevention trial" url=https://clinicaltrials.gov/study/NCT00715676 reviewFlags="broad-safety-query, low-title-query-overlap" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" reviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" intervention=vitamin-d claim=vitamin-d-deficiency`
      ].join("\n")
    );
  });

  it("prints explicit pending source-candidate decisions as the review queue", async () => {
    const stdout = vi.fn();
    const listCandidates = vi.fn().mockResolvedValue([
      sourceCandidate({
        dedupeKey: "pubmed|au|creatine|28615996|creatine-strength",
        title: "Creatine position stand"
      })
    ]);
    const listSiblings = vi.fn().mockResolvedValue(sourceCandidateSiblings());

    await expect(
      runSourceCandidateJobCommand(
        ["--candidates", "--candidate-decision", "pending"],
        { stdout },
        { listCandidates, listSiblings }
      )
    ).resolves.toBe(0);

    expect(listCandidates).toHaveBeenCalledWith({
      claimId: undefined,
      decision: "Pending review",
      externalId: undefined,
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: undefined,
      region: undefined,
      source: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review queue: total=1",
        `- triage=80/100 PubMed AU dedupe="pubmed|au|creatine|28615996|creatine-strength" key=${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")} packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine|28615996|creatine-strength")}" externalId="28615996" query="creatine strength" title="Creatine position stand" url=https://pubmed.ncbi.nlm.nih.gov/28615996/`
      ].join("\n")
    );
  });

  it("prints a read-only source-candidate review overview", async () => {
    const stdout = vi.fn();
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 17,
      totalGroups: 3,
      groups: [
        {
          claimId: "omega-3-cv-events",
          count: 9,
          interventionId: "omega-3",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey:
              "clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events",
            externalId: "NCT01492361",
            source: "ClinicalTrials.gov",
            title: "A Study of AMR101 to Evaluate Its Ability to Reduce Cardiovascular Events",
            triageScore: 100
          }),
          topIdentityCandidateCount: 2,
          topTriageScore: 100
        },
        {
          claimId: "omega-3-cv-events",
          count: 5,
          interventionId: "omega-3",
          region: "AU",
          source: "PubMed",
          topCandidate: sourceCandidate({
            dedupeKey: "pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events",
            externalId: "32634581",
            title: "Omega-3 cardiovascular outcomes meta-analysis"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        },
        {
          count: 3,
          region: "AU",
          source: "PubMed",
          topCandidate: sourceCandidate({
            claimId: undefined,
            dedupeKey: "pubmed|au|creatine-meta|42158825||",
            externalId: "42158825",
            interventionId: undefined,
            title: "Unscoped creatine meta-analysis"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-review-overview",
          "--candidate-review-overview-limit",
          "5",
          "--candidate-claim-id",
          "omega-3-cv-events",
          "--candidate-region",
          "AU"
        ],
        { stdout },
        { listReviewOverview, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listReviewOverview).toHaveBeenCalledWith({
      claimId: "omega-3-cv-events",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: 5,
      region: "AU",
      source: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review overview: totalGroups=3 candidateCount=17",
        `- claim=omega-3-cv-events intervention=omega-3 ClinicalTrials.gov AU pending=9 topTriage=100/100 topKey=${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")} topExternalId="NCT01492361" topIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source clinical-trials --candidate-external-id NCT01492361 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" topTitle="A Study of AMR101 to Evaluate Its Ability to Reduce Cardiovascular Events" list="--candidates --candidate-claim-id omega-3-cv-events --candidate-intervention-id omega-3 --candidate-region AU --candidate-source clinical-trials --candidates-limit 9" packet="--candidate-review-packet ${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")}" siblings="--candidate-siblings ${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")}" curationStatus="--candidate-curation-status ${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("clinicaltrials.gov|au|omega-cv|nct01492361|omega-3|omega-3-cv-events")}"`,
        `- claim=omega-3-cv-events intervention=omega-3 PubMed AU pending=5 topTriage=80/100 topKey=${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")} topExternalId="32634581" topTitle="Omega-3 cardiovascular outcomes meta-analysis" list="--candidates --candidate-claim-id omega-3-cv-events --candidate-intervention-id omega-3 --candidate-region AU --candidate-source pubmed --candidates-limit 5" packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events")}"`,
        `- claim=none intervention=none PubMed AU pending=3 topTriage=80/100 topKey=${safeCandidateKey("pubmed|au|creatine-meta|42158825||")} topExternalId="42158825" topTitle="Unscoped creatine meta-analysis" list="--candidates --candidate-claim-missing --candidate-intervention-missing --candidate-region AU --candidate-source pubmed --candidates-limit 3" packet="--candidate-review-packet ${safeCandidateKey("pubmed|au|creatine-meta|42158825||")}" referenceMatches="--candidate-reference-matches ${safeCandidateKey("pubmed|au|creatine-meta|42158825||")}" siblings="--candidate-siblings ${safeCandidateKey("pubmed|au|creatine-meta|42158825||")}" curationStatus="--candidate-curation-status ${safeCandidateKey("pubmed|au|creatine-meta|42158825||")}" curationDraft="--candidate-curation-draft ${safeCandidateKey("pubmed|au|creatine-meta|42158825||")}"`
      ].join("\n")
    );
  });

  it("prints read-only source-candidate review flags", async () => {
    const stdout = vi.fn();
    const flaggedKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const lowOverlapKey =
      "clinicaltrials.gov|au|creatine-lifespan|nct07451496|creatine|creatine-lifespan";
    const unflaggedKey = "pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events";
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 12,
      totalGroups: 4,
      groups: [
        {
          claimId: "vitamin-d-deficiency",
          count: 10,
          interventionId: "vitamin-d",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey: flaggedKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D safety adverse effects",
            title: "Vitamin D safety monitoring trial",
            triageScore: 100,
            interventionId: "vitamin-d",
            claimId: "vitamin-d-deficiency"
          }),
          topIdentityCandidateCount: 2,
          topTriageScore: 100
        },
        {
          claimId: "creatine-lifespan",
          count: 1,
          interventionId: "creatine",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey: lowOverlapKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT07451496",
            query: "creatine monohydrate longevity mortality lifespan",
            title: "Healthy ageing lifestyle supplement program",
            triageScore: 80,
            interventionId: "creatine",
            claimId: "creatine-lifespan"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        },
        {
          claimId: "omega-3-cv-events",
          count: 1,
          interventionId: "omega-3",
          region: "AU",
          source: "PubMed",
          topCandidate: sourceCandidate({
            dedupeKey: unflaggedKey,
            externalId: "32634581",
            query: "omega-3 cardiovascular events",
            title: "Omega-3 cardiovascular events meta-analysis",
            claimId: "omega-3-cv-events",
            interventionId: "omega-3"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-review-flags",
          "--candidate-review-flag",
          "broad-safety-query",
          "--candidate-review-flags-limit",
          "3",
          "--candidate-claim-id",
          "vitamin-d-deficiency",
          "--candidate-region",
          "AU"
        ],
        { stdout },
        { listReviewOverview, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listReviewOverview).toHaveBeenCalledWith({
      claimId: "vitamin-d-deficiency",
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: 3,
      region: "AU",
      source: undefined
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        'Source-candidate review flags: totalGroups=4 candidateCount=12 shown=3 flag="broad-safety-query" flaggedTopGroups=1',
        `- flags="broad-safety-query" topReviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION}" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" claim=vitamin-d-deficiency intervention=vitamin-d ClinicalTrials.gov AU pending=10 topTriage=100/100 topKey=${safeCandidateKey(flaggedKey)} topExternalId="NCT00715676" topIdentityCandidates=2 duplicates="--candidates --candidate-duplicates --candidate-source clinical-trials --candidate-external-id NCT00715676 --candidates-limit 2" duplicateCaution="${DUPLICATE_IDENTITY_CAUTION}" topTitle="Vitamin D safety monitoring trial" list="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 10" packet="--candidate-review-packet ${safeCandidateKey(flaggedKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(flaggedKey)}" siblings="--candidate-siblings ${safeCandidateKey(flaggedKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(flaggedKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(flaggedKey)}" overview="--candidate-review-overview --candidate-review-overview-limit 10"`
      ].join("\n")
    );
  });

  it("uses selected review flags in missing-intervention flag focus commands", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676||vitamin-d-deficiency";
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 1,
      totalGroups: 1,
      groups: [
        {
          claimId: "vitamin-d-deficiency",
          count: 1,
          interventionId: undefined,
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey: candidateKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D safety adverse effects",
            title: "Calcium fracture prevention trial",
            url: "https://clinicaltrials.gov/study/NCT00715676",
            claimId: "vitamin-d-deficiency"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        [
          "--candidate-review-flags",
          "--candidate-review-flag",
          "low-title-query-overlap"
        ],
        { stdout },
        { listReviewOverview }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        'Source-candidate review flags: totalGroups=1 candidateCount=1 flag="low-title-query-overlap" flaggedTopGroups=1',
        `- flags="broad-safety-query, low-title-query-overlap" topReviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" flagFocus="--candidate-review-flags --candidate-review-flag low-title-query-overlap --candidate-claim-id vitamin-d-deficiency --candidate-intervention-missing --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" claim=vitamin-d-deficiency intervention=none ClinicalTrials.gov AU pending=1 topTriage=80/100 topKey=${safeCandidateKey(candidateKey)} topExternalId="NCT00715676" topTitle="Calcium fracture prevention trial" list="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-missing --candidate-region AU --candidate-source clinical-trials --candidates-limit 1" packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}" siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}" overview="--candidate-review-overview --candidate-review-overview-limit 10"`
      ].join("\n")
    );
  });

  it("prints an empty source-candidate review flags view", async () => {
    const stdout = vi.fn();
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 1,
      totalGroups: 1,
      groups: [
        {
          claimId: "omega-3-cv-events",
          count: 1,
          interventionId: "omega-3",
          region: "AU",
          source: "PubMed",
          topCandidate: sourceCandidate({
            dedupeKey: "pubmed|au|omega-cv|32634581|omega-3|omega-3-cv-events",
            externalId: "32634581",
            query: "omega-3 cardiovascular events",
            title: "Omega-3 cardiovascular events meta-analysis",
            claimId: "omega-3-cv-events",
            interventionId: "omega-3"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 80
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-review-flags"],
        { stdout },
        { listReviewOverview }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      "Source-candidate review flags: totalGroups=1 candidateCount=1 flaggedTopGroups=0"
    );
  });

  it("prints an empty source-candidate review overview", async () => {
    const stdout = vi.fn();
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 0,
      groups: [],
      totalGroups: 0
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-review-overview"],
        { stdout },
        { listReviewOverview }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      "Source-candidate review overview: totalGroups=0 candidateCount=0"
    );
  });

  it("prints top review flags in the source-candidate review overview", async () => {
    const stdout = vi.fn();
    const candidateKey =
      "clinicaltrials.gov|au|vitamin-d-safety|nct00715676|vitamin-d|vitamin-d-deficiency";
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 1,
      totalGroups: 1,
      groups: [
        {
          claimId: "vitamin-d-deficiency",
          count: 1,
          interventionId: "vitamin-d",
          region: "AU",
          source: "ClinicalTrials.gov",
          topCandidate: sourceCandidate({
            dedupeKey: candidateKey,
            source: "ClinicalTrials.gov",
            externalId: "NCT00715676",
            query: "Vitamin D safety adverse effects",
            title: "Calcium fracture prevention trial",
            triageScore: 100,
            interventionId: "vitamin-d",
            claimId: "vitamin-d-deficiency"
          }),
          topIdentityCandidateCount: 1,
          topTriageScore: 100
        }
      ]
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--candidate-review-overview"],
        { stdout },
        { listReviewOverview }
      )
    ).resolves.toBe(0);

    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate review overview: totalGroups=1 candidateCount=1",
        `- claim=vitamin-d-deficiency intervention=vitamin-d ClinicalTrials.gov AU pending=1 topTriage=100/100 topKey=${safeCandidateKey(candidateKey)} topExternalId="NCT00715676" topReviewFlags="broad-safety-query, low-title-query-overlap" topReviewCautions="broad-safety-query: ${BROAD_SAFETY_CAUTION} | low-title-query-overlap: ${LOW_TITLE_OVERLAP_CAUTION}" flags="--candidate-review-flags --candidate-review-flags-limit 10" flagFocus="--candidate-review-flags --candidate-review-flag broad-safety-query --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidate-review-flags-limit 10" topTitle="Calcium fracture prevention trial" list="--candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 1" packet="--candidate-review-packet ${safeCandidateKey(candidateKey)}" referenceMatches="--candidate-reference-matches ${safeCandidateKey(candidateKey)}" siblings="--candidate-siblings ${safeCandidateKey(candidateKey)}" curationStatus="--candidate-curation-status ${safeCandidateKey(candidateKey)}" curationDraft="--candidate-curation-draft ${safeCandidateKey(candidateKey)}"`
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
      externalId: undefined,
      ingestionJobId: undefined,
      interventionId: undefined,
      limit: undefined,
      region: undefined,
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
        claimId: "creatine-strength",
        jobId: "job-pubmed",
        interventionId: "creatine",
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
        '- [SUCCEEDED] job-pubmed PUBMED AU "creatine strength" found=5 changed=3 updated=2026-06-02T01:02:00.000Z candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-intervention-id creatine --jobs-claim-id creatine-strength --jobs-limit 10" statusJobs="--jobs --jobs-status succeeded --jobs-limit 10" intervention=creatine claim=creatine-strength',
        '- [FAILED] job-trials CLINICALTRIALS_GOV AU "creatine aging" found=0 changed=0 updated=2026-06-02T02:01:00.000Z candidates="--candidates --candidate-job-id job-trials --candidates-limit 10" contextJobs="--jobs --jobs-source clinical-trials --jobs-region AU --jobs-limit 10" statusJobs="--jobs --jobs-status failed --jobs-limit 10" error=ClinicalTrials unavailable'
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

  it("passes recent job status filters to the read-only job list", async () => {
    const stdout = vi.fn();
    const listJobs = vi.fn().mockResolvedValue([
      {
        jobId: "job-pubmed",
        source: "PUBMED",
        query: "creatine strength",
        region: "AU",
        status: "QUEUED",
        recordsFound: 0,
        recordsChanged: 0,
        updatedAt: "2026-06-02T01:02:00.000Z",
        createdAt: "2026-06-02T00:00:00.000Z"
      }
    ]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--jobs", "--jobs-status", "queued"],
        { stdout },
        { listJobs, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listJobs).toHaveBeenCalledWith({
      limit: undefined,
      status: "QUEUED"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate ingestion jobs: total=1",
        '- [QUEUED] job-pubmed PUBMED AU "creatine strength" found=0 changed=0 updated=2026-06-02T01:02:00.000Z candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-limit 10" statusJobs="--jobs --jobs-status queued --jobs-limit 10"'
      ].join("\n")
    );
  });

  it("passes recent job context filters to the read-only job list", async () => {
    const stdout = vi.fn();
    const listJobs = vi.fn().mockResolvedValue([]);
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        [
          "--jobs",
          "--jobs-source",
          "clinical-trials",
          "--jobs-region",
          "au",
          "--jobs-intervention-id",
          "creatine",
          "--jobs-claim-id",
          "creatine-strength",
          "--jobs-status",
          "queued"
        ],
        { stdout },
        { listJobs, runNextJob }
      )
    ).resolves.toBe(0);

    expect(listJobs).toHaveBeenCalledWith({
      claimId: "creatine-strength",
      interventionId: "creatine",
      limit: undefined,
      region: "au",
      source: "ClinicalTrials.gov",
      status: "QUEUED"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith("Source-candidate ingestion jobs: total=0");
  });

  it("queues a source-candidate ingestion job without running jobs", async () => {
    const stdout = vi.fn();
    const queueJob = vi.fn().mockResolvedValue({
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
      '[QUEUED] job-pubmed PUBMED AU "creatine strength" created=true candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-intervention-id creatine --jobs-claim-id creatine-strength --jobs-limit 10" statusJobs="--jobs --jobs-status queued --jobs-limit 10" intervention=creatine claim=creatine-strength'
    );
  });

  it("queues claim source-candidate jobs without running jobs", async () => {
    const stdout = vi.fn();
    const queueClaimSources = vi.fn().mockResolvedValue({
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
          created: false,
          interventionId: "creatine",
          jobId: "job-trials-creatine-strength",
          source: "CLINICALTRIALS_GOV",
          query: "Creatine monohydrate strength resistance training lean mass gains",
          region: "AU",
          status: "SUCCEEDED"
        }
      ]
    });
    const runNextJob = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--queue-claim-sources", "creatine-strength", "--region", "au"],
        { stdout },
        { queueClaimSources, runNextJob }
      )
    ).resolves.toBe(0);

    expect(queueClaimSources).toHaveBeenCalledWith({
      claimId: "creatine-strength",
      region: "au"
    });
    expect(runNextJob).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      [
        'Claim source-candidate jobs: "Creatine monohydrate - Muscle/strength" claim=creatine-strength intervention=creatine region=AU',
        '- [QUEUED] job-pubmed-creatine-strength PUBMED AU "Creatine monohydrate strength resistance training lean mass gains randomized trial systematic review" created=true candidates="--candidates --candidate-job-id job-pubmed-creatine-strength --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-intervention-id creatine --jobs-claim-id creatine-strength --jobs-limit 10" statusJobs="--jobs --jobs-status queued --jobs-limit 10" intervention=creatine claim=creatine-strength',
        '- [SUCCEEDED] job-trials-creatine-strength CLINICALTRIALS_GOV AU "Creatine monohydrate strength resistance training lean mass gains" created=false candidates="--candidates --candidate-job-id job-trials-creatine-strength --candidates-limit 10" contextJobs="--jobs --jobs-source clinical-trials --jobs-region AU --jobs-intervention-id creatine --jobs-claim-id creatine-strength --jobs-limit 10" statusJobs="--jobs --jobs-status succeeded --jobs-limit 10" intervention=creatine claim=creatine-strength'
      ].join("\n")
    );
  });

  it("reports existing queued jobs without claiming them", async () => {
    const stdout = vi.fn();
    const queueJob = vi.fn().mockResolvedValue({
      claimId: "creatine-strength",
      contextMismatchFields: ["interventionId"],
      created: false,
      interventionId: "creatine",
      jobId: "job-pubmed",
      source: "PUBMED",
      query: "creatine strength",
      region: "AU",
      status: "SUCCEEDED"
    });
    const runJobById = vi.fn();

    await expect(
      runSourceCandidateJobCommand(
        ["--queue-pubmed", "creatine strength", "--intervention-id", "different-context"],
        { stdout },
        { queueJob, runJobById }
      )
    ).resolves.toBe(0);

    expect(queueJob).toHaveBeenCalledWith({
      source: "PubMed",
      query: "creatine strength",
      region: undefined,
      interventionId: "different-context",
      claimId: undefined
    });
    expect(runJobById).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      '[SUCCEEDED] job-pubmed PUBMED AU "creatine strength" created=false candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-intervention-id creatine --jobs-claim-id creatine-strength --jobs-limit 10" statusJobs="--jobs --jobs-status succeeded --jobs-limit 10" intervention=creatine claim=creatine-strength requestedContextMismatch="interventionId"'
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

  it("returns a failing exit code when claim source queueing fails", async () => {
    const stderr = vi.fn();
    const queueClaimSources = vi
      .fn()
      .mockRejectedValue(new Error("Source-candidate ingestion job claim not found: missing."));

    await expect(
      runSourceCandidateJobCommand(
        ["--queue-claim-sources", "missing"],
        { stderr },
        { queueClaimSources }
      )
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledWith(
      "Source-candidate ingestion job claim not found: missing."
    );
  });

  it("prints an empty backlog summary", async () => {
    const stdout = vi.fn();
    const summarizeJobs = vi.fn().mockResolvedValue({
      total: 0,
      groups: []
    });
    const summarizeBacklog = vi.fn().mockResolvedValue({
      total: 0,
      groups: []
    });
    const summarizeCurationHandoff = vi.fn().mockResolvedValue({
      total: 0,
      groups: []
    });
    const listReviewOverview = vi.fn().mockResolvedValue({
      candidateCount: 0,
      groups: [],
      totalGroups: 0
    });

    await expect(
      runSourceCandidateJobCommand(
        ["--summary"],
        { stdout },
        { listReviewOverview, summarizeBacklog, summarizeCurationHandoff, summarizeJobs }
      )
    ).resolves.toBe(0);

    expect(listReviewOverview).toHaveBeenCalledWith({ limit: 50 });
    expect(stdout).toHaveBeenCalledWith(
      [
        "Source-candidate ingestion jobs: total=0",
        "Source-candidate backlog: total=0",
        "Source-candidate curation handoff: total=0",
        "Source-candidate review flag focus: totalGroups=0 candidateCount=0 flaggedTopGroups=0",
        "Source-candidate read-only next commands",
        'reviewOverview="--candidate-review-overview --candidate-review-overview-limit 10"',
        'reviewFlags="--candidate-review-flags --candidate-review-flags-limit 10"',
        'duplicates="--candidates --candidate-duplicates"',
        'queuedJobs="--jobs --jobs-status queued"',
        'curationHandoff="--candidate-curation-handoff"'
      ].join("\n")
    );
  });

  it("runs one queued job with an explicit run-next flag", async () => {
    const stdout = vi.fn();
    const runNextJob = vi
      .fn()
      .mockResolvedValueOnce(jobResult({ jobId: "job-pubmed" }));

    await expect(
      runSourceCandidateJobCommand(["--run-next"], { stdout }, { runNextJob })
    ).resolves.toBe(0);

    expect(runNextJob).toHaveBeenCalledTimes(1);
    expect(runNextJob).toHaveBeenCalledWith({
      clinicalTrialPageSize: undefined,
      pubMedRetmax: undefined
    });
    expect(stdout).toHaveBeenCalledWith(
      '[SUCCEEDED] job-pubmed PUBMED AU "creatine strength" found=1 changed=1 candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-limit 10" statusJobs="--jobs --jobs-status succeeded --jobs-limit 10"'
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
        ["--run-next", "--limit", "5", "--pubmed-retmax", "3"],
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
      '[SUCCEEDED] job-target PUBMED AU "creatine strength" found=1 changed=1 candidates="--candidates --candidate-job-id job-target --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-limit 10" statusJobs="--jobs --jobs-status succeeded --jobs-limit 10"'
    );
  });

  it("prints an empty-queue message when no queued jobs exist", async () => {
    const stdout = vi.fn();
    const runNextJob = vi.fn().mockResolvedValue(null);

    await expect(
      runSourceCandidateJobCommand(["--run-next"], { stdout }, { runNextJob })
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
      runSourceCandidateJobCommand(["--run-next"], { stdout }, { runNextJob })
    ).resolves.toBe(1);

    expect(stdout).toHaveBeenCalledWith(
      '[FAILED] job-pubmed PUBMED AU "creatine strength" found=0 changed=0 candidates="--candidates --candidate-job-id job-pubmed --candidates-limit 10" contextJobs="--jobs --jobs-source pubmed --jobs-region AU --jobs-limit 10" statusJobs="--jobs --jobs-status failed --jobs-limit 10" error=NCBI unavailable'
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

function sourceCandidateSiblings(overrides: Record<string, unknown> = {}) {
  return {
    target: sourceCandidate(),
    siblings: [],
    ...overrides
  };
}

function studyCommandArgs(extra: string[] = []) {
  return [
    "--extract-candidate-study",
    "pubmed|au|creatine|28615996",
    "--study-sample-size",
    "n=80",
    "--study-population",
    "Healthy adults",
    "--study-intervention-name",
    "Creatine monohydrate",
    "--study-outcome",
    "Strength",
    "--study-outcome",
    "Lean mass",
    "--study-adverse-events",
    "No serious adverse events reported.",
    "--study-funding-conflicts",
    "Funding conflicts disclosed.",
    "--study-risk-of-bias",
    "Moderate risk of bias.",
    ...extra
  ];
}
