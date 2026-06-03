# Source Candidate Curation Handoff List

## Goal
Add a read-only local command mode that lists accepted source candidates with their curation handoff readiness so operators can find claim-link or extraction gaps without checking one dedupe key at a time.

## Constraints
- Keep this under the private/local `npm run ingest:sources` operator workflow.
- Do not promote candidates, mutate review state, or expose public routes.
- Reuse existing curation status wording: claim-link missing, extraction pending, public source packet ready, and related accepted-reference states.
- Keep output framed as handoff readiness, not evidence quality.

## Done Condition
- Data helper lists bounded accepted candidate curation statuses.
- CLI exposes a read-only list mode with a bounded limit.
- Parser isolation prevents mixing the list mode with queue, review, ingestion, jobs, summary, detail, and single-status modes.
- Tests cover ready, pending, missing-link, empty list, and CLI output.
- README and project memory document the new operator command.

## Files Likely Touched
- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Validation
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Output could imply accepted candidates are already public evidence; wording must keep this as curation handoff readiness.
- Avoid per-row database queries that become noisy for a bounded list.
