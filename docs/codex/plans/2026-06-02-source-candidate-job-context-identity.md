# Source Candidate Job Context Identity

## Goal

Make source-candidate ingestion jobs claim/context-aware so operators can queue the same source/query/region for different intervention or claim contexts without being trapped by an older unscoped job.

## Constraints

- Keep ingestion and review local/operator-only.
- Preserve existing queued/completed jobs by backfilling valid metadata context into first-class columns.
- Keep public app routes read-only and untouched.
- Use PostgreSQL-safe uniqueness for nullable intervention/claim context.
- Do not reset completed jobs or mutate old jobs when queueing new scoped work.

## Done Condition

- `IngestionJob` has first-class optional `interventionId` and `claimId` fields.
- Queue identity includes source, normalized query, region, intervention id, and claim id.
- Existing jobs with valid metadata-only context are backfilled and then list/run from first-class context columns.
- Operators can create separate unscoped, intervention-scoped, claim-scoped, and intervention+claim-scoped jobs for the same source/query/region.
- Tests cover new lookup/create behavior, valid metadata backfill expectations, and canonical first-class context reads.
- README, workflow docs, and project memory describe context-aware queue identity.

## Files Likely Touched

- `prisma/schema.prisma`
- `prisma/migrations/20260602061000_ingestion_job_context_identity/migration.sql`
- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `README.md`
- `docs/codex/source-candidate-workflow.md`
- `docs/codex/project.md`

## Validation

- `npm run db:validate`
- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Nullable unique constraints need partial indexes; normal Prisma `@@unique` would allow duplicate null-context jobs.
- Existing jobs may have context stored only in metadata; migration should backfill valid trimmed values and runtime should treat first-class columns as canonical to avoid stale JSON fallback.
