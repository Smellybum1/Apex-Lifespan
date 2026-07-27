import { describe, expect, it } from "vitest";

import { commandUsage } from "@/lib/data/source-candidate-job-command-usage";

describe("commandUsage", () => {
  it("describes source-candidate review guardrails", () => {
    expect(commandUsage()).toContain(
      "--env-file <path>                 Load an approved local env file before Prisma-backed source-candidate inspection."
    );
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
      "--queue-intervention-sources <id> Queue broad PubMed/ClinicalTrials.gov discovery jobs for one intervention."
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
    expect(commandUsage()).toContain(
      "--watch                           With --run-next, keep polling queued jobs with a rate-limited sleep between attempts."
    );
    expect(commandUsage()).toContain(
      "--db-status                       Check local PostgreSQL connectivity without reading review data."
    );
  });
});
