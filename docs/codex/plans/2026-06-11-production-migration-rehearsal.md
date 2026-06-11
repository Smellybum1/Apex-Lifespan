# Production Migration Rehearsal Helper

## Goal

Make the Step 3 non-production `migrate deploy` rehearsal explicit, fail-closed, and easy to record without committing secrets or touching production by accident.

## Scope

- Add a dry-run-default local command for production migration rehearsal planning.
- Require a managed non-local `DATABASE_URL`, `APEX_DATA_SOURCE=database`, committed migrations, `APEX_MIGRATION_REHEARSAL_TARGET=non-production`, and `--apply` before running commands.
- Run `npm run db:validate` before `npm run db:migrate:deploy` when applied.
- Add production readiness evidence for `APEX_MIGRATION_REHEARSAL_PASSED_AT`.

## Validation

- Focused rehearsal and production readiness tests.
- Local dry-run command smoke.
- Production and launch readiness reports.
- Typecheck, build, lint, audit, and `git diff --check`.
