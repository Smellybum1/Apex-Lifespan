# Source Candidate Workflow

Local operator workflow for PubMed and ClinicalTrials.gov source candidates. Use `npm run ingest:sources -- --help` for the live flag list and `docs/codex/reference/source-candidate-command-reference.md` only when the compact guide is not enough.

## Rules

- Public routes and the public dashboard do not run this workflow or persist candidates.
- Candidates are review leads; triage scores rank review priority, not evidence quality.
- Accept/reject decisions require a human review note. Acceptance also requires an existing curated reference that matches the candidate source and external id.
- Accepted candidates do not auto-promote into public evidence cards.
- Curation writes are explicit local commands: first claim link, then structured study extraction.
- Study extraction fields are human-entered; the command may draft metadata, but it should not invent sample size, population, outcomes, adverse events, funding/conflicts, or risk of bias.

## Quick Flow

1. Check DB: `npm run ingest:sources -- --db-status`
2. Inspect state: `npm run ingest:sources -- --summary`
3. Choose a group: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
4. Inspect flagged groups when useful: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`
5. Inspect a candidate packet, siblings, and reference matches before any decision.
6. Record accept/reject only after human review.
7. For accepted candidates, run curation handoff/status/draft before any claim-link or extraction write.

## Common Commands

```bash
npm run ingest:sources -- --db-status
npm run ingest:sources -- --summary
npm run ingest:sources -- --jobs --jobs-status queued
npm run ingest:sources -- --run-next --limit 1
npm run ingest:sources -- --queue-claim-sources <claim-id>
npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10
npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10
npm run ingest:sources -- --candidates --candidates-limit 10
npm run ingest:sources -- --candidates --candidate-duplicates
npm run ingest:sources -- --candidate-review-packet <dedupe-key>
npm run ingest:sources -- --candidate-reference-matches <dedupe-key>
npm run ingest:sources -- --candidate-siblings <dedupe-key>
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id> --review-note "Human-reviewed rationale."
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Human-reviewed rationale."
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
npm run ingest:sources -- --candidate-curation-draft <dedupe-key>
```

Prefer emitted `key=b64:...` values on Windows when passing a `<dedupe-key>`.

## Curation Readiness

- `Not accepted`: pending or rejected candidate.
- `Accepted reference missing`: no accepted reference id or referenced row missing.
- `Accepted reference mismatch`: accepted reference no longer matches candidate source and external id.
- `Candidate claim missing`: accepted candidate has no claim id.
- `Claim link missing`: accepted reference is not linked to the candidate claim.
- `Extraction pending`: accepted reference is claim-linked but lacks structured study extraction.
- `Public source packet ready`: accepted reference is claim-linked and structurally extracted.
