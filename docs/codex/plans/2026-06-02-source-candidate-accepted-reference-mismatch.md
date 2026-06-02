# Source Candidate Curation Readiness Guards

## Goal

Flag accepted source candidates whose accepted curated reference no longer matches the candidate source/external id or whose candidate claim context is missing, so curation handoff cannot mistake stale or unscoped links for public source-packet readiness.

## Constraints

- Keep this read-only in curation status, handoff, and summary views.
- Do not auto-promote, relink, or mutate source candidates or curated references.
- Reuse the existing source/external-id match predicate used by acceptance.
- Keep the public source-packet readiness claim-scoped.
- Keep wording framed as curation handoff readiness, not evidence quality.

## Done Condition

- Single-candidate curation status reports `Accepted reference mismatch` when the accepted reference exists but fails the source/external-id match.
- Single-candidate curation status reports `Candidate claim missing` when an accepted candidate has no claim id.
- Handoff rows and summary counts include both guard states.
- Operator docs and project memory describe the state and next action.
- Tests cover single status, handoff listing, summary grouping, and CLI output formatting.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `docs/codex/source-candidate-workflow.md`
- `docs/codex/project.md`
- `README.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- HTTP smoke after restarting the dev server if typecheck stops it.

## Risks

- Over-reporting a mismatch would hide valid curation work; reuse the existing accepted-reference predicate instead of adding new matching logic.
- Some accepted candidates may be intentionally broad; keep those out of public claim-level source-packet readiness until reviewed against a concrete claim.
