# Source Candidate Workflow

Source-candidate ingestion is a private local operator workflow. It writes to configured PostgreSQL and must stay out of public app routes.

## Boundary

- Public PubMed and ClinicalTrials.gov previews are read-only leads.
- Ingestion and review writes live under `npm run ingest:sources`.
- Accepted candidates do not auto-promote into curated evidence cards.
- Accepted candidates must link to an existing curated reference whose source and external id match the candidate.
- Rejected candidates require a nonblank human review note.
- Curation handoff status is readiness for public source packets, not evidence quality.

## Commands

Run one queued job:

```bash
npm run ingest:sources
```

Queue jobs:

```bash
npm run ingest:sources -- --queue-pubmed "creatine strength randomized trial systematic review"
npm run ingest:sources -- --queue-clinical-trials "creatine aging"
npm run ingest:sources -- --queue-claim-sources <claim-id>
```

Queue metadata:

```bash
npm run ingest:sources -- --queue-pubmed "creatine strength" --region AU --intervention-id <intervention-id> --claim-id <claim-id>
npm run ingest:sources -- --queue-claim-sources <claim-id> --region AU
```

Queue options create a missing job or report the existing job for the same source, query, region, intervention id, and claim id. They do not reset completed jobs or retarget stored intervention/claim context. When queueing with both intervention and claim context, the claim must belong to that intervention; missing claim or intervention context fails before a job is created. The migration backfills valid older metadata-backed job context into first-class columns, and new queue identity is context-aware so the same query can be queued separately for different claim-level curation work.

`--queue-claim-sources <claim-id>` validates the claim and intervention through Prisma, builds the active-claim PubMed and ClinicalTrials.gov terms, and queues or reports both claim-scoped jobs. It does not run ingestion or write review, curation, claim-link, study-extraction, or public evidence rows.

Read-only operator views:

```bash
npm run ingest:sources -- --jobs
npm run ingest:sources -- --candidates
npm run ingest:sources -- --candidates --candidate-source pubmed --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-job-id <ingestion-job-id>
npm run ingest:sources -- --candidates --candidate-intervention-id <intervention-id>
npm run ingest:sources -- --candidates --candidate-claim-id <claim-id>
npm run ingest:sources -- --candidates --candidate-decision accepted
npm run ingest:sources -- --candidates --candidate-decision rejected
npm run ingest:sources -- --candidate-detail <dedupe-key>
npm run ingest:sources -- --candidate-curation-draft <dedupe-key>
npm run ingest:sources -- --candidate-siblings <dedupe-key>
npm run ingest:sources -- --candidate-siblings <dedupe-key> --candidate-siblings-limit 10
npm run ingest:sources -- --candidate-reference-matches <dedupe-key>
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --candidate-curation-handoff --candidate-claim-id <claim-id>
npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status candidate-claim-missing
npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status reference-mismatch
npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status extraction-pending
npm run ingest:sources -- --summary
```

Review actions:

```bash
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Not relevant to this claim."
npm run ingest:sources -- --link-candidate-claim <dedupe-key>
npm run ingest:sources -- --link-candidate-claim <dedupe-key> --claim-link-relevance 4 --claim-link-note "Primary source for this claim."
npm run ingest:sources -- --extract-candidate-study <dedupe-key> --study-sample-size "n=80" --study-population "Healthy adults" --study-intervention-name "Creatine monohydrate" --study-outcome "Strength" --study-adverse-events "No serious adverse events reported." --study-funding-conflicts "Funding disclosed." --study-risk-of-bias "Moderate risk of bias."
```

`--link-candidate-claim` writes only a `ClaimReference` row after validating the candidate is accepted, claim-scoped, and attached to a matching accepted reference. It does not create references, study extractions, source documents, or public evidence promotions.

`--extract-candidate-study` writes only a `Study` row after validating the candidate is accepted, claim-scoped, attached to a matching accepted reference, and already claim-linked. The operator must supply the manual extraction fields; ambiguous source types require `--study-source-type`. It does not create references, claim links, source documents, decisions, or public evidence promotions.

Run controls:

```bash
npm run ingest:sources -- --limit 5
npm run ingest:sources -- --job-id <ingestion-job-id>
npm run ingest:sources -- --pubmed-retmax 10
npm run ingest:sources -- --clinical-trial-page-size 10
```

## Output Rules

- Job output reports ingestion-operation counts, not evidence-quality scores.
- `--jobs` reports recent job ids, statuses, counts, stored context, and errors.
- `--queue-claim-sources` prints the generated PubMed and ClinicalTrials.gov query text plus queued or existing job ids.
- `--summary` includes ingestion job counts by source, region, and status before candidate backlog and curation handoff counts.
- `--candidates` defaults to pending rows and can filter by source, job, intervention, claim, or decision.
- `--candidate-detail` prints one candidate with triage reasons, review fields, and compact metadata.
- `--candidate-curation-draft` prints one candidate's accepted-reference status plus read-only claim-link and study-extraction draft fields; it does not create references, claim links, studies, or decisions.
- `--candidate-siblings` prints the target candidate plus same-source/external-id and same-query/context sibling rows with match reasons; it is read-only curation context, not review automation.
- `--candidate-reference-matches` prints candidate identity plus curated references eligible for acceptance.
- `--candidate-curation-status` reports candidate-claim, accepted-reference, claim-link, extraction, readiness, and next action for one candidate.
- `--candidate-curation-handoff` lists accepted candidates by readiness and can filter before applying the row limit.
- `--extract-candidate-study` reports the written study id and resulting curation readiness.
- `--summary` groups ingestion job status counts, backlog counts, and accepted-candidate curation handoff counts.

## Curation Readiness

- `Not accepted`: pending or rejected candidates.
- `Accepted reference missing`: accepted candidate has no accepted reference id or the referenced row is missing.
- `Accepted reference mismatch`: accepted reference exists but no longer matches the candidate source and external id.
- `Candidate claim missing`: accepted candidate has no claim id, so it is not ready for claim-level public source packets.
- `Claim link missing`: accepted reference is not linked to the candidate claim.
- `Extraction pending`: accepted reference is claim-linked but lacks structured study extraction.
- `Public source packet ready`: accepted reference is claim-linked and structurally extracted.
