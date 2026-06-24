# Production Provisioning Step 3 Kickoff

Date: 2026-06-24

## Goal

Start roadmap step 3 by giving operators a safe managed-database connectivity probe and a clearer provisioning order before migration rehearsal.

## Scope

- Add `npm run production:connectivity` with optional `--probe`.
- Keep output sanitized: no credentials, no raw Prisma error dumps.
- Document the step 3 execution order in the production provisioning checklist.
- Do not commit secrets, create Neon/Vercel resources, or enable production database mode in this slice.

## Operator Path

1. Configure Neon + Vercel Preview/staging variables.
2. Export non-production `DATABASE_URL` and `APEX_DATA_SOURCE=database` locally.
3. `npm run production:connectivity`
4. `npm run production:connectivity -- --probe`
5. `npm run production:migration-rehearsal -- --apply`
6. Record `APEX_MIGRATION_REHEARSAL_PASSED_AT`

## Validation

- `npm run test -- src/lib/production-database-connectivity.test.ts`
- `npm run production:connectivity`
- `npm run typecheck`
- `npm run lint`
