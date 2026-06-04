# Source Candidate Workflow

Open this only for source-candidate ingestion, review, or curation work. Use `npm run ingest:sources -- --help` for the live flag list and `docs/codex/reference/source-candidate-command-reference.md` for the full command catalog.

## Boundary

- Private local operator workflow; writes go only to configured PostgreSQL.
- Public PubMed and ClinicalTrials.gov previews stay read-only leads.
- Candidate `/100` values are triage scores, not evidence quality.
- `reviewFlags`/`reviewCautions` are local reviewer prompts, not rejection reasons or evidence-quality scores.
- Accepted candidates do not auto-promote into public evidence cards.
- Accepting requires an existing curated reference matching candidate source and external id plus a nonblank human review note.
- Rejections require a nonblank human review note and no accepted reference id.

## Quick Flow

1. Inspect state: `npm run ingest:sources` or `npm run ingest:sources -- --summary`.
2. Choose a review group: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
3. Optional flag focus: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10`.
4. List pending candidates: `npm run ingest:sources -- --candidates --candidates-limit 10`.
5. Inspect one candidate: `npm run ingest:sources -- --candidate-review-packet <dedupe-key>`.
6. Human review only after checking candidate, siblings, and reference matches.
7. Post-acceptance curation stays explicit: claim link first, then structured study extraction.

## Common Commands

```bash
npm run ingest:sources -- --summary
npm run ingest:sources -- --jobs --jobs-status queued
npm run ingest:sources -- --run-next --limit 1
npm run ingest:sources -- --queue-claim-sources <claim-id>
npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10
npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10
npm run ingest:sources -- --candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10
npm run ingest:sources -- --candidates --candidate-claim-missing --candidate-intervention-missing
npm run ingest:sources -- --candidates --candidate-duplicates
npm run ingest:sources -- --candidate-review-packet <dedupe-key>
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id> --review-note "Human-reviewed rationale."
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Reason."
npm run ingest:sources -- --candidate-curation-handoff
```

No-arg command output matches `--summary` and stays read-only.
Summary output prints read-only next-command hints for overview, review flags, duplicate scan, queued jobs, and curation handoff; non-empty curation bucket rows include `nextAction` text plus status-filtered handoff hints, and a bounded review flag focus block highlights flagged top review groups with caution text, duplicate hints plus `duplicateCaution` when the top PMID/NCT identity repeats, and list/packet/reference-match/sibling/curation/flag-wide `flags` plus scoped `flagFocus` drill-ins.
Job rows print read-only candidate-list, context-jobs, and status-jobs hints.
Queue and explicit `--run-next` result rows print read-only candidate-list, context-jobs, and status-jobs follow-ups; they do not print run templates.
Candidate-oriented output prints `key=b64:...`; prefer that shell-safe value on Windows anywhere `<dedupe-key>` is accepted.
Candidate filters support `--candidate-claim-missing` and `--candidate-intervention-missing` for exact read-only slices of unscoped rows.
When emitted beside a row or review group, `flags="..."` stays broad while `flagFocus="..."` includes the selected review flag, or the first listed flag when no flag filter is active, plus the row context filters for claim, intervention, region, and source; copy `flagFocus` exactly for a narrowed read-only focus view.
Candidate detail output prints read-only packet, reference-match, sibling, group-list, curation-status, curation-draft hints, duplicate hints plus `duplicateCaution` when the PMID/NCT identity repeats, compact `reviewFlags` plus `flags="..."` and `flagFocus="..."` drill-ins, and explanatory `reviewCautions` when a claim-scoped candidate needs extra broad-query/off-claim scrutiny.
Candidate list rows print `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, duplicate hints plus `duplicateCaution` when the PMID/NCT identity repeats, source-query and ingestion-job trace fields, and compact `reviewFlags`/`reviewCautions` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable.
Review overview rows print `list="..."` for the filtered pending group, including missing-claim/intervention filters for unscoped contexts, region, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, and curation-status/draft hints for the top candidate drill-in, duplicate hints plus `duplicateCaution` when the top PMID/NCT identity repeats, and `topReviewFlags`/`topReviewCautions` plus `flags="..."` and first-flag `flagFocus="..."` drill-ins when applicable. When top triage ties, repeated PMID/NCT identities are preferred for the top candidate so duplicate cleanup risk is visible in the overview.
Review flag rows filter the bounded overview to flagged top candidates only, optionally narrow with `--candidate-review-flag`, and print compact `flags`, `topReviewCautions`, `flagFocus="..."`, duplicate hints plus `duplicateCaution`, `list="..."`, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, and `overview="..."` without changing review state.
Reference-match headings print `packet="..."`, `siblings="..."`, `groupList="..."`, curation-status/draft hints, duplicate hints plus `duplicateCaution` when the PMID/NCT identity repeats, and compact `reviewFlags`/`reviewCautions` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable; draft references remain draft-only and require manual verification.
Review packets print read-only follow-up commands, curation-status/draft hints, conditional duplicate count/caution and focused review-flag hints, accepted-reference match count, explicit accept-gate booleans, and accept/reject templates; write templates still require explicit human review notes.
Sibling headings print `targetPacket="..."`, `targetReferenceMatches="..."`, target curation-status/draft hints, and duplicate hints plus `duplicateCaution` when the target PMID/NCT identity repeats, and rows print `packet="..."`, `referenceMatches="..."`, and curation-status/draft hints for read-only review of related candidates plus `targetReviewFlags`/`targetReviewCautions`, `reviewFlags`/`reviewCautions`, `flags="..."`, and `flagFocus="..."` drill-ins when applicable.
Duplicate identity rows print `identityList="..."` plus `duplicateCaution` for the filtered duplicate group and `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft, exact `groupList="..."` hints, accepted-reference/review-note fields for reviewed rows, and explicit `intervention`/`claim` context including `none`, plus `reviewFlags`, `reviewCautions`, `flags="..."`, and `flagFocus="..."` for each candidate row when applicable.
Curation handoff rows print read-only packet, reference-match, sibling, curation-status, curation-draft hints, `nextWrite`/`writeReady` plus `writeReview` draft drill-ins, duplicate hints plus `duplicateCaution` when the PMID/NCT identity repeats, accepted-reference/review-note fields for reviewed rows, and compact `reviewFlags`/`reviewCautions` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable.
Curation status and draft rows print read-only packet, reference-match, sibling, group-list, paired curation-view hints, Not-accepted accept-gate booleans, duplicate hints plus `duplicateCaution` when the PMID/NCT identity repeats, accepted-reference/review-note fields for reviewed rows, and compact `reviewFlags`/`reviewCautions` plus `flags="..."` and `flagFocus="..."` drill-ins when applicable; curation draft rows can include guarded claim-link and study-extraction `commandTemplate` values with `writeReady`/`blockedUntil` fields, and they still require explicit operator-run write commands plus human-entered extraction fields.

## Curation Readiness

- `Not accepted`: pending or rejected candidates.
- `Accepted reference missing`: no accepted reference id or referenced row missing.
- `Accepted reference mismatch`: accepted reference no longer matches candidate source/external id.
- `Candidate claim missing`: accepted candidate has no claim id.
- `Claim link missing`: accepted reference is not linked to the candidate claim.
- `Extraction pending`: accepted reference is claim-linked but lacks structured study extraction.
- `Public source packet ready`: accepted reference is claim-linked and structurally extracted.
