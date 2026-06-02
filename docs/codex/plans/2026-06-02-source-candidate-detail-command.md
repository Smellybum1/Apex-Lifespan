# Source Candidate Detail Command

## Goal

Add a read-only local command mode for inspecting one source candidate before an operator accepts or rejects it.

## Constraints

- Keep public routes and UI unchanged.
- Do not write to the database.
- Preserve triage-score wording and source-candidate framing.
- Include review fields when present without calling the candidate curated evidence.
- Keep output deterministic and useful for terminal review.
- Escape multiline/control text and print only bounded allowlisted metadata fields.

## Done Condition

- `npm run ingest:sources -- --candidate-detail <dedupe-key>` prints a single source-candidate detail record.
- Missing candidates return a clear message with exit code `1`.
- Tests cover helper lookup, parser conflicts, output formatting, and empty/missing behavior.
- README and project memory document the read-only detail mode.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Metadata may contain arbitrary source payload fragments; keep output compact by formatting only bounded allowlisted top-level scalar/list fields.
