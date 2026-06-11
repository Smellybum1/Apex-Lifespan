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

## Vercel Environment Packet

Use this copy-safe packet while entering Vercel project variables. Store real values only in Vercel or Neon; keep this file value-free.

| Key | Preview / staging | Production | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Non-production Neon URL | Production Neon URL | Use managed non-local PostgreSQL only; do not paste local Docker URLs. |
| `APEX_DATA_SOURCE` | `database` | `database` only after rehearsal and smoke checks pass | Fully-live mode should fail closed instead of silently masking database failures with seed fallback. |
| `AUTH_SECRET` | Non-production Auth.js secret | Production Auth.js secret | Generate separately per environment. |
| `AUTH_GITHUB_ID` | Non-production GitHub OAuth app/client ID | Production GitHub OAuth app/client ID | Use operator-owned OAuth credentials. |
| `AUTH_GITHUB_SECRET` | Non-production GitHub OAuth secret | Production GitHub OAuth secret | Do not reuse in local docs or screenshots. |
| `NCBI_TOOL` | `apex-lifespan` | `apex-lifespan` | Required before unattended PubMed ingestion. |
| `NCBI_EMAIL` | Operator contact email | Operator contact email | Required before unattended PubMed ingestion. |
| `APEX_OPERATOR_WRITES_ENABLED` | `false` until QA session | `false` by default | Enable only during controlled, reviewed operator workflows. |
| `APEX_SCHEDULED_INGESTION_WRITES_ENABLED` | `false` until approval | `false` until approval | Hosted ingestion must stay human-owned with no auto-promotion. |

Do not add these local-only Codex sidecar variables to Vercel: `APEX_CODEX_THREAD_ID`, `APEX_CODEX_REVIEW_TOKEN`, `APEX_CODEX_REVIEW_PORT`, `APEX_CODEX_REVIEW_ORIGINS`, `APEX_CODEX_REVIEW_TIMEOUT_MS`, or `APEX_CODEX_MODEL`.

Do not record evidence variables such as `APEX_MIGRATION_REHEARSAL_PASSED_AT`, `APEX_OPERATOR_NONPROD_WRITE_QA_AT`, or `APEX_FULLY_LIVE_LAUNCH_APPROVED_AT` until the matching checklist item has actually been completed and reviewed.

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
