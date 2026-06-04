# Source Candidate Command Reference

Reference only. For startup, read `docs/codex/source-candidate-workflow.md` instead. The live source of truth for flags is:

```bash
npm run ingest:sources -- --help
```

## Queue Jobs

```bash
npm run ingest:sources -- --queue-pubmed "creatine strength randomized trial systematic review"
npm run ingest:sources -- --queue-clinical-trials "creatine aging"
npm run ingest:sources -- --queue-claim-sources <claim-id>
npm run ingest:sources -- --queue-pubmed "creatine strength" --region AU --intervention-id <intervention-id> --claim-id <claim-id>
npm run ingest:sources -- --queue-claim-sources <claim-id> --region AU
```

Queue options create a missing job or report the existing job for the same source, query, region, intervention id, and claim id. They do not reset completed jobs or retarget stored context. Claim-scoped queueing validates the claim/intervention relationship before creating jobs.

## Read-Only Views

```bash
npm run ingest:sources -- --summary
npm run ingest:sources -- --jobs
npm run ingest:sources -- --jobs --jobs-status queued
npm run ingest:sources -- --jobs --jobs-status failed
npm run ingest:sources -- --jobs --jobs-status queued --jobs-claim-id <claim-id>
npm run ingest:sources -- --jobs --jobs-source pubmed --jobs-region AU
npm run ingest:sources -- --candidates
npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10
npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10
npm run ingest:sources -- --candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10
npm run ingest:sources -- --candidates --candidate-source pubmed --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-region AU --candidate-source pubmed --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-duplicates
npm run ingest:sources -- --candidates --candidate-external-id <pmid-or-nct-id>
npm run ingest:sources -- --candidates --candidate-intervention-id <intervention-id>
npm run ingest:sources -- --candidates --candidate-claim-id <claim-id>
npm run ingest:sources -- --candidates --candidate-claim-missing --candidate-intervention-missing
npm run ingest:sources -- --candidate-detail <dedupe-key>
npm run ingest:sources -- --candidate-review-packet <dedupe-key>
npm run ingest:sources -- --candidate-reference-matches <dedupe-key>
npm run ingest:sources -- --candidate-siblings <dedupe-key>
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
npm run ingest:sources -- --candidate-curation-draft <dedupe-key>
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status extraction-pending
```

Read-only output rules:
- `--summary` groups ingestion job status counts, backlog counts, accepted-candidate curation handoff counts, status-filtered handoff hints, bounded review flag focus counts with list/packet/reference-match/sibling/curation/flag-wide `flags` and scoped `flagFocus` drill-ins, and read-only next-command hints for overview, review flags, duplicates, queued jobs, and curation handoff.
- `--jobs` prints recent ingestion jobs plus read-only candidate-list, context-jobs, and status-jobs hints.
- Queue/run result rows print read-only candidate-list, context-jobs, and status-jobs follow-ups; they do not print run templates.
- When a row or group emits both `flags="..."` and `flagFocus="..."`, `flags` stays broad and `flagFocus` adds the selected review flag, or the first listed flag when no flag filter is active, plus the row context filters for claim, intervention, region, and source for an exact read-only focus view.
- `--candidate-detail` prints one record plus read-only packet/reference/sibling/group/curation hints, compact `reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins, and explanatory `reviewCautions` when a claim-scoped candidate needs extra broad-query/off-claim scrutiny.
- `--candidate-review-overview` groups pending rows by review context and prints read-only `list="..."`, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, top-identity duplicate hints, and `topReviewFlags` plus `flags="..."` and first-flag `flagFocus="..."` drill-ins when applicable. Unscoped groups include `--candidate-claim-missing` and/or `--candidate-intervention-missing` in generated list hints, and repeated PMID/NCT identities are preferred for top-candidate tie-breaks when triage scores match.
- `--candidate-review-flags` filters the bounded review overview to flagged top candidates only, can narrow with `--candidate-review-flag`, and prints read-only `flags`, `flagFocus="..."`, `list="..."`, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, `overview="..."`, and top-identity duplicate hints when applicable.
- `--candidates` defaults to pending rows, prints `packet="..."`, `referenceMatches="..."`, `siblings="..."`, and curation-status/draft hints plus query/job trace fields and compact `reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable, and can filter by source, region, external id, job, intervention, missing intervention, claim, missing claim, or decision.
- `--candidates --candidate-duplicates` groups duplicate PMID/NCT identities and prints read-only `identityList="..."`, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft, exact `groupList="..."` hints, accepted-reference/review-note fields for reviewed rows, explicit `intervention`/`claim` context including `none`, and compact `reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable.
- `--candidate-reference-matches` prints candidate identity plus `packet="..."`, `siblings="..."`, `groupList="..."`, curation-status/draft hints, and compact `reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable before eligible curated references or draft-only reference context.
- `--candidate-review-packet` prints command hints, detail, accepted-reference match count, accepted-reference matches, sibling context, curation-status/draft hints, duplicate hints when the identity repeats, focused review-flag hints when the candidate is flagged, and explicit accept-gate booleans.
- `--candidate-siblings` prints match reasons, `targetPacket="..."`, `targetReferenceMatches="..."`, and target curation-status/draft heading hints, row-level `packet="..."`, `referenceMatches="..."`, and curation-status/draft hints, and compact `targetReviewFlags`/`reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable.
- Packet accept/reject templates are copied commands only; they still require explicit human review notes and do not create references or public evidence.
- `reviewFlags`/`reviewCautions` are local reviewer prompts, not rejection reasons or evidence-quality scores.
- Empty `--candidate-reference-matches` output includes a draft-only `referenceDraft=...` line for manual verification; it does not create a reference or mark the candidate accepted.
- `--candidate-curation-status` and `--candidate-curation-draft` report readiness for public source packets, not evidence quality, and print read-only packet/reference/sibling/group/paired-curation hints, Not-accepted accept-gate booleans, and compact `reviewFlags`, `flags="..."`, and `flagFocus="..."` drill-ins when applicable.
- `--candidate-curation-handoff` reports accepted-candidate readiness for public source packets, not evidence quality, and non-empty rows print read-only packet/reference/sibling/status/draft hints plus compact `reviewFlags`, `flags="..."`, and `flagFocus="..."` drill-ins when applicable.

## Review And Curation Writes

```bash
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id> --review-note "Human-reviewed rationale."
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Not relevant to this claim."
npm run ingest:sources -- --link-candidate-claim <dedupe-key>
npm run ingest:sources -- --link-candidate-claim <dedupe-key> --claim-link-relevance 4 --claim-link-note "Primary source for this claim."
npm run ingest:sources -- --extract-candidate-study <dedupe-key> --study-sample-size "n=80" --study-population "Healthy adults" --study-intervention-name "Creatine monohydrate" --study-outcome "Strength" --study-adverse-events "No serious adverse events reported." --study-funding-conflicts "Funding disclosed." --study-risk-of-bias "Moderate risk of bias."
```

Write boundaries:
- `--accept-candidate` records human review only after a matching curated reference exists and the operator supplies a nonblank human note.
- `--reject-candidate` requires a nonblank human note and no accepted reference id.
- `--link-candidate-claim` writes only a `ClaimReference` row after accepted candidate, claim context, and matching-reference gates pass.
- `--extract-candidate-study` writes only a `Study` row after acceptance, matching-reference, claim-context, and claim-link gates pass. The operator must supply manual extraction fields.
- None of these commands create references, source documents, public evidence promotions, or automatic medical claims.

## Run Controls

```bash
npm run ingest:sources
npm run ingest:sources -- --limit 5
npm run ingest:sources -- --job-id <ingestion-job-id>
npm run ingest:sources -- --pubmed-retmax 10
npm run ingest:sources -- --clinical-trial-page-size 10
```
