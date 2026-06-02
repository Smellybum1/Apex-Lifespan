# Source Candidate Workflow

Source-candidate ingestion is a private local operator workflow. It writes to configured PostgreSQL and must stay out of public app routes.

## Boundary

- Public PubMed and ClinicalTrials.gov previews are read-only leads.
- Ingestion and review writes live under `npm run ingest:sources`.
- Accepted candidates do not auto-promote into curated evidence cards.
- Accepted candidates must link to an existing curated reference whose source and external id match the candidate.
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
```

Queue metadata:

```bash
npm run ingest:sources -- --queue-pubmed "creatine strength" --region AU --intervention-id <intervention-id> --claim-id <claim-id>
```

Queue options create a missing job or report the existing job for the same source, query, and region. They do not reset completed jobs or retarget stored intervention/claim context. Existing-job output reports `requestedContextMismatch` when requested context differs from stored metadata.

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
npm run ingest:sources -- --candidate-reference-matches <dedupe-key>
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --candidate-curation-handoff --candidate-claim-id <claim-id>
npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status extraction-pending
npm run ingest:sources -- --summary
```

Review actions:

```bash
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Not relevant to this claim."
```

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
- `--candidates` defaults to pending rows and can filter by source, job, intervention, claim, or decision.
- `--candidate-detail` prints one candidate with triage reasons, review fields, and compact metadata.
- `--candidate-reference-matches` prints curated references eligible for acceptance.
- `--candidate-curation-status` reports accepted-reference, claim-link, extraction, readiness, and next action for one candidate.
- `--candidate-curation-handoff` lists accepted candidates by readiness and can filter before applying the row limit.
- `--summary` groups backlog counts and accepted-candidate curation handoff counts.

## Curation Readiness

- `Not accepted`: pending or rejected candidates.
- `Accepted reference missing`: accepted candidate has no accepted reference id or the referenced row is missing.
- `Claim link missing`: accepted reference is not linked to the candidate claim.
- `Extraction pending`: accepted reference is claim-linked but lacks structured study extraction.
- `Public source packet ready`: accepted reference is claim-linked and structurally extracted.
