# Source Candidate Overview Duplicate Hints

## Goal

Show duplicate-identity context in the read-only source-candidate review overview so operators can spot top candidates whose PMID/NCT identity appears in another pending context.

## Constraints

- Keep overview output read-only.
- Use the existing candidate scan; do not add writes or public routes.
- Preserve source-candidate triage wording.
- Keep duplicate review explicit and human-owned.

## Acceptance

- Overview groups expose the top candidate identity count.
- CLI output prints duplicate-list hints only when the top identity appears more than once.
- Tests cover data grouping and command formatting.
- Workflow docs and handoff mention the duplicate overview hint.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
