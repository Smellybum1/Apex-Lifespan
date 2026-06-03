# Dashboard Data Source Tests

## Goal

Add focused regression tests for the dashboard data loader's seed/database selection behavior promised in the README and project memory.

## Constraints

- Do not require Docker or a live PostgreSQL instance.
- Do not change Prisma schema or seed data.
- Keep tests deterministic and avoid real database calls on the tested branches.
- Preserve public read-only MVP behavior.

## Done Condition

- Tests cover forced seed mode.
- Tests cover missing `DATABASE_URL` fallback.
- Tests cover configured-but-unreachable database fallback.
- Tests cover strict `APEX_DATA_SOURCE=database` failure when the database is unavailable.
- Validation passes.

## Files Likely Touched

- `src/lib/data/dashboard.test.ts`
- `docs/codex/project.md`

## Steps

1. Add env-isolated tests for `getEvidenceDashboardData`.
2. Assert fallback reasons, data source, and representative seed data.
3. Run targeted and full validation.

## Validation

- `npm run test -- src/lib/data/dashboard.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Environment variables can leak between tests if not restored.
- A real local database should not be required for these fallback tests.

## Result

- Added `src/lib/data/dashboard.test.ts` covering forced seed mode, missing `DATABASE_URL`, invalid/unreachable configured database fallback, and strict database mode failure.
- Mocked `@/lib/db/prisma` in the tests and asserted fallback branches do not call Prisma reads.
- Updated project memory to record the new data-source coverage.
- Validation passed: targeted dashboard data tests, full test suite, lint, typecheck, build, and local HTTP smoke.
