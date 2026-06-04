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
npm run ingest:sources -- --candidates --candidate-source pubmed --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-region AU --candidate-source pubmed --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-duplicates
npm run ingest:sources -- --candidates --candidate-external-id <pmid-or-nct-id>
npm run ingest:sources -- --candidates --candidate-intervention-id <intervention-id>
npm run ingest:sources -- --candidates --candidate-claim-id <claim-id>
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
- `--summary` groups ingestion job status counts, backlog counts, and accepted-candidate curation handoff counts.
- `--candidate-review-overview` groups pending rows by review context and prints read-only `list="..."`, `packet="..."`, and top-identity duplicate hints.
- `--candidates` defaults to pending rows, prints `packet="..."` hints, and can filter by source, region, external id, job, intervention, claim, or decision.
- `--candidates --candidate-duplicates` groups duplicate PMID/NCT identities and prints read-only `identityList="..."` and `packet="..."` hints.
- `--candidate-review-packet` prints command hints, detail, accepted-reference matches, sibling context, and duplicate hints when the identity repeats.
- Packet accept/reject templates are copied commands only; they still require explicit human review and do not create references or public evidence.
- Empty `--candidate-reference-matches` output includes a draft-only `referenceDraft=...` line for manual verification; it does not create a reference or mark the candidate accepted.
- `--candidate-curation-status` and `--candidate-curation-handoff` report readiness for public source packets, not evidence quality.

## Review And Curation Writes

```bash
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Not relevant to this claim."
npm run ingest:sources -- --link-candidate-claim <dedupe-key>
npm run ingest:sources -- --link-candidate-claim <dedupe-key> --claim-link-relevance 4 --claim-link-note "Primary source for this claim."
npm run ingest:sources -- --extract-candidate-study <dedupe-key> --study-sample-size "n=80" --study-population "Healthy adults" --study-intervention-name "Creatine monohydrate" --study-outcome "Strength" --study-adverse-events "No serious adverse events reported." --study-funding-conflicts "Funding disclosed." --study-risk-of-bias "Moderate risk of bias."
```

Write boundaries:
- `--accept-candidate` records human review only after a matching curated reference exists.
- `--reject-candidate` requires a nonblank human note.
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
