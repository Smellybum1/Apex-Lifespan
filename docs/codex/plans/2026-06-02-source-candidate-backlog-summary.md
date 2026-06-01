# Source Candidate Backlog Summary

## Goal

Add read-only source-candidate backlog visibility for local operators so ingestion output and review backlog can be inspected without opening the database.

## Constraints

- Keep public routes read-only and unchanged.
- Summary must not imply evidence quality; it reports workflow counts only.
- Group by source, region, decision, and review status.
- Reuse the private `npm run ingest:sources` command rather than adding a new public surface.

## Done Condition

- Backend helper returns source-candidate backlog totals and grouped counts.
- `npm run ingest:sources -- --summary` prints the read-only backlog summary.
- Tests cover grouped DB mapping, empty summaries, command output, and command runner injection.
- README and project memory document the operator-only summary flag.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps

1. Add source-candidate backlog summary types and Prisma groupBy helper.
2. Add `--summary` parsing and command output.
3. Extend mocked tests for data helper and command behavior.
4. Update docs and run validation.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Workflow counts can be mistaken for evidence strength; command and docs should keep the wording operational.
