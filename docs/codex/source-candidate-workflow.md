# Source Candidate Workflow

Open this only for source-candidate ingestion, review, or curation work. Use `npm run ingest:sources -- --help` for the live flag list and `docs/codex/reference/source-candidate-command-reference.md` for the full command catalog.

## Boundary

- Private local operator workflow; writes go only to configured PostgreSQL.
- Public PubMed and ClinicalTrials.gov previews stay read-only leads.
- Candidate `/100` values are triage scores, not evidence quality.
- Accepted candidates do not auto-promote into public evidence cards.
- Accepting requires an existing curated reference matching candidate source and external id.
- Rejections require a nonblank human review note.

## Quick Flow

1. Inspect state: `npm run ingest:sources -- --summary`.
2. Choose a review group: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
3. List pending candidates: `npm run ingest:sources -- --candidates --candidates-limit 10`.
4. Inspect one candidate: `npm run ingest:sources -- --candidate-review-packet <dedupe-key>`.
5. Human review only after checking candidate, siblings, and reference matches.
6. Post-acceptance curation stays explicit: claim link first, then structured study extraction.

## Common Commands

```bash
npm run ingest:sources -- --summary
npm run ingest:sources -- --jobs --jobs-status queued
npm run ingest:sources -- --queue-claim-sources <claim-id>
npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10
npm run ingest:sources -- --candidates --candidate-duplicates
npm run ingest:sources -- --candidate-review-packet <dedupe-key>
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Reason."
npm run ingest:sources -- --candidate-curation-handoff
```

Summary output prints read-only next-command hints for overview, duplicate scan, queued jobs, and curation handoff.
Candidate-oriented output prints `key=b64:...`; prefer that shell-safe value on Windows anywhere `<dedupe-key>` is accepted.
Candidate list rows print `packet="..."` for read-only packet review.
Review overview rows print `list="..."` for the filtered pending group, including region, `packet="..."` for the top candidate drill-in, and duplicate hints when the top PMID/NCT identity repeats.
Reference-match headings print `packet="..."` and `groupList="..."`; draft references remain draft-only and require manual verification.
Review packets print read-only follow-up commands, conditional duplicate hints, and accept/reject templates; write templates still require explicit human review.
Sibling rows print `packet="..."` for read-only packet review of related candidates.
Duplicate identity rows print `identityList="..."` for the filtered duplicate group and `packet="..."` for each candidate row.
Curation status and draft rows print read-only packet, reference-match, group-list, and paired curation-view hints.

## Curation Readiness

- `Not accepted`: pending or rejected candidates.
- `Accepted reference missing`: no accepted reference id or referenced row missing.
- `Accepted reference mismatch`: accepted reference no longer matches candidate source/external id.
- `Candidate claim missing`: accepted candidate has no claim id.
- `Claim link missing`: accepted reference is not linked to the candidate claim.
- `Extraction pending`: accepted reference is claim-linked but lacks structured study extraction.
- `Public source packet ready`: accepted reference is claim-linked and structurally extracted.
