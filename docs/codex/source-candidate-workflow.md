# Source Candidate Workflow

Local operator workflow for PubMed and ClinicalTrials.gov source candidates. Use `npm run ingest:sources -- --help` for the live flag list and `docs/codex/reference/source-candidate-command-reference.md` only when the compact guide is not enough.

## Rules

- Public routes and the public dashboard do not run this workflow or persist candidates.
- Candidates are review leads; triage scores rank review priority, not evidence quality.
- Accept/reject decisions require a review note. Codex may make audited `AI reviewed` decisions using best judgment; acceptance also requires an existing curated reference that matches the candidate source and external id.
- Prepare missing curated references with `--prepare-candidate-reference`; it previews by default and writes only with `--write-candidate-reference`.
- Accepted candidates do not auto-promote into public evidence cards.
- Curation writes are explicit local commands: first claim link, then structured study extraction.
- Study extraction fields must be source-backed; Codex may draft or write them as `AI reviewed`, but it must not invent sample size, population, outcomes, adverse events, funding/conflicts, or risk of bias.

## Quick Flow

1. Check DB: `npm run ingest:sources -- --db-status`
2. Inspect state: `npm run ingest:sources -- --summary`
3. Choose a group: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
4. Inspect flagged groups when useful: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`
5. Inspect a candidate packet, siblings, and reference matches before any decision.
6. Record accept/reject with a Codex or operator review note.
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
npm run ingest:sources -- --prepare-candidate-reference <dedupe-key>
npm run ingest:sources -- --prepare-candidate-reference <dedupe-key> --write-candidate-reference
npm run ingest:sources -- --candidate-siblings <dedupe-key>
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id> --review-note "AI-reviewed rationale."
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "AI-reviewed rationale."
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
npm run ingest:sources -- --candidate-curation-draft <dedupe-key>
npm run evidence:apply-ready
npm run evidence:apply-ready -- --fixture-ready
npm run evidence:apply-ready -- --write
```

For approved ignored Preview/operations env files, add `--env-file <env-file>` before the inspection or write flags, for example:

```bash
npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-review-overview --candidate-review-overview-limit 10
npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-review-packet <dedupe-key>
npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-curation-handoff
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

Use `npm run evidence:apply-ready` to preview all accepted local packets that can safely create missing claim links or record AI-reviewed public-packet promotion. Use `npm run evidence:apply-ready -- --fixture-ready` for a deterministic no-DB ready-promotion rehearsal that prints transaction scope, verification, rollback, and command copy. Add `--write` only when applying audited local impact steps from real DB rows. The dry run also prints bounded upstream candidate leads; use `--upstream-limit <count>` to adjust that read-only hint list. Extraction-pending rows remain blocked until source-backed fields are prepared.

Before one-off public promotion, use `docs/codex/curation-promotion-checklist.md` and confirm `npm run promotion:dry-run -- <dedupe-key>` reports no blockers. The dry run emits read-only follow-up commands under `worksheet.readOnlyCommands`.
