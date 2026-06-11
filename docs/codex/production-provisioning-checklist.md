# Production Provisioning Checklist

Last updated: 2026-06-11

Use this checklist when moving from the seed-backed public demo to managed database-backed production. Keep secrets in Vercel/Neon only; do not commit database URLs, OAuth secrets, Auth.js secrets, or exported data.

## Preconditions

- Confirm the target Vercel project is the public Apex Lifespan project.
- Confirm Neon is the selected managed PostgreSQL provider from `docs/codex/production-data-architecture.md`.
- Keep public routes read-only and operator writes disabled while provisioning.
- Keep `APEX_DATA_SOURCE=seed` for the public demo until database-mode smoke and rollback checks pass.

## Vercel And Neon Setup

1. Create or link the Neon integration from the Vercel Marketplace for the Apex Lifespan project.
2. Create separate production and non-production database targets.
3. Set the Neon region according to the production data architecture decision unless a new region decision is documented.
4. Add Vercel environment variables in the intended scopes:
   - Preview or staging: non-production `DATABASE_URL`, `APEX_DATA_SOURCE=database`.
   - Production: production `DATABASE_URL`, `APEX_DATA_SOURCE=database` only after rehearsal and smoke checks pass.
   - Operator auth: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`.
   - Scheduled ingestion metadata: `NCBI_TOOL`, `NCBI_EMAIL`.
5. Do not add local Codex sidecar variables to Vercel.
6. Keep `APEX_OPERATOR_WRITES_ENABLED=false` and `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=false` until the relevant non-production QA and approval evidence exists.

## Local Verification

Run these from the local checkout after environment setup is available:

```bash
npm run production:readiness
npm run production:migration-rehearsal
npm run production:migration-rehearsal -- --apply
npm run launch:readiness
```

Record `APEX_MIGRATION_REHEARSAL_PASSED_AT` only after reviewing the non-production target and command results.

## Before Production Database Mode

- Verify Neon backups/PITR are enabled and recorded in operations readiness.
- Complete a non-production restore rehearsal.
- Confirm public smoke and browser QA pass in database mode.
- Confirm `/operator` remains closed to anonymous users.
- Confirm rollback steps are rehearsed for both Vercel app rollback and Neon data restore.
- Keep source-candidate promotion and operator writes human-reviewed and explicitly gated.
