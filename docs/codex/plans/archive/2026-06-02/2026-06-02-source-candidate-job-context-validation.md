# Source Candidate Job Context Validation

## Goal

Validate source-candidate ingestion job context before queueing so a supplied claim id cannot be paired with the wrong intervention id.

## Constraints

- Keep ingestion local/operator-only.
- Do not infer medical relevance or promote candidates.
- Preserve claim-only and intervention-only queue buckets.
- Keep the context-aware job identity from the prior migration.

## Done Condition

- Queueing with a missing claim id fails before job lookup/create.
- Queueing with an intervention id only validates that intervention exists.
- Queueing with both claim and intervention fails when the claim belongs to a different intervention.
- Valid queue contexts still create or return jobs as before.
- Operator docs and project memory record the consistency rule.

## Files Likely Touched

- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `README.md`
- `docs/codex/source-candidate-workflow.md`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

## Risks

- Extra validation queries add a small queue-time cost, but prevent harder-to-debug candidate context drift.
