# Source Candidate Rejection Note

## Goal

Require a nonblank human review note when an operator rejects a source candidate so rejected citation leads have an audit trail.

## Constraints

- Keep review writes operator-only under `npm run ingest:sources`.
- Do not require notes for accepted candidates beyond existing accepted-reference guardrails.
- Do not change public live-source routes.
- Preserve pending-only review updates.

## Done Condition

- `--reject-candidate` fails without a nonblank `--review-note`.
- `recordSourceCandidateDecision` rejects direct rejected decisions without a nonblank note.
- Accepted candidate behavior remains unchanged.
- Operator docs describe the requirement.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `docs/codex/source-candidate-workflow.md`
- `README.md`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

## Risks

- Avoid losing existing accepted-review note flexibility.
- Keep rejection note wording about audit trail, not medical judgment.
