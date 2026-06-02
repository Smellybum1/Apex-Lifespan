# Source Candidate Reviewed Listing

## Goal

Let operators inspect accepted or rejected source-candidate review records from the local command without exposing review writes through public routes.

## Constraints

- Keep public routes and UI unchanged.
- Keep `--candidates` defaulting to pending review rows.
- Make accepted/rejected listing read-only and bounded.
- Preserve triage-score wording; do not call reviewed candidates curated evidence.
- Show accepted reference, reviewed time, and review note when available.

## Done Condition

- `npm run ingest:sources -- --candidates --candidate-decision accepted` lists accepted candidate review records.
- `npm run ingest:sources -- --candidates --candidate-decision rejected` lists rejected candidate review records.
- Tests cover parsing, helper inputs, output formatting, empty state, and mode conflicts.
- README and project memory document the read-only decision filter.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Reviewed candidates might be mistaken for promoted evidence; output should keep them framed as source-candidate review records.
