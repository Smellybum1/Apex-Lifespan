# Production Provisioning Checklist

Last updated: 2026-06-13

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
4. Confirm the Vercel project is connected either through GitHub import or a local `.vercel/project.json` link. If using GitHub import, record `APEX_VERCEL_PROJECT_CONFIGURED_AT` only after confirming the project, repository, branch, and production domain in the Vercel dashboard.
5. Add Vercel environment variables in the intended scopes:
   - Preview or staging: non-production `DATABASE_URL`, `APEX_DATA_SOURCE=database`.
   - Production: production `DATABASE_URL`, `APEX_DATA_SOURCE=database` only after rehearsal and smoke checks pass.
   - Operator auth: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`.
   - Scheduled ingestion metadata: `NCBI_TOOL`, `NCBI_EMAIL`.
6. Do not add local Codex sidecar variables to Vercel.
7. Keep `APEX_OPERATOR_WRITES_ENABLED=false` and `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=false` until the relevant non-production QA and approval evidence exists.

## Staging-First Dashboard Sequence

Use this order after the GitHub-imported Vercel project is confirmed and the seed-backed public demo is working:

1. Keep the public Production environment in seed mode while provisioning.
2. In the Vercel project dashboard, confirm the connected repository, production branch, and production domain; record `APEX_VERCEL_PROJECT_CONFIGURED_AT` only after those are reviewed.
3. Create the non-production Neon target first and add only Preview/staging `DATABASE_URL` plus `APEX_DATA_SOURCE=database`; record `APEX_VERCEL_DATABASE_CONFIGURED_AT` and `APEX_VERCEL_DATABASE_MODE_CONFIGURED_AT` only after the Vercel variables are reviewed.
4. Add Preview/staging Auth.js and GitHub OAuth variables for operator QA; keep write controls disabled until the exact execution control is needed. Record `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT` only after confirming the Vercel variables exist without exposing their values.
5. Run `npm run production:readiness` and `npm run production:migration-rehearsal` with the non-production managed database environment available locally or through the approved secret manager. If the approved secret manager produces a local ignored env file, pass it with `--env-file <non-production-env-file>` rather than pasting secrets into the shell.
6. Rerun `npm run production:migration-rehearsal -- --apply` only after confirming `APEX_MIGRATION_REHEARSAL_TARGET=non-production` and the URL is not local or production. If using an env file, use the explicit apply form: `npm run production:migration-rehearsal -- --env-file <non-production-env-file> --apply`.
7. Record `APEX_MIGRATION_REHEARSAL_PASSED_AT` only after reviewing the rehearsal output.
8. Configure the Production Neon target and Production `DATABASE_URL`, then keep `APEX_DATA_SOURCE=seed` until backups, restore rehearsal, rollback drill, and database-mode public QA are ready.
9. Switch Production `APEX_DATA_SOURCE=database` only for the reviewed fully-live cutover, then redeploy and run public smoke immediately.

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

Do not record evidence variables such as `APEX_VERCEL_PROJECT_CONFIGURED_AT`, `APEX_VERCEL_DATABASE_CONFIGURED_AT`, `APEX_VERCEL_DATABASE_MODE_CONFIGURED_AT`, `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT`, `APEX_MIGRATION_REHEARSAL_PASSED_AT`, `APEX_OPERATOR_NONPROD_WRITE_QA_AT`, or `APEX_FULLY_LIVE_LAUNCH_APPROVED_AT` until the matching checklist item has actually been completed and reviewed.

## Production GitHub OAuth

Production uses a separate GitHub OAuth app from Preview/staging so callback URLs and test sessions do not mix.

Use these production app values:

- Application name: `Apex Lifespan Production`
- Homepage URL: `https://apex-lifespan.vercel.app`
- Authorization callback URL: `https://apex-lifespan.vercel.app/api/auth/callback/github`

After the app is created in GitHub Developer Settings, store only these values in Vercel Production:

- Client ID -> `AUTH_GITHUB_ID`
- Client secret -> `AUTH_GITHUB_SECRET`

`AUTH_SECRET` is already generated separately per environment. Do not reuse Preview OAuth credentials unless the Production callback URL is explicitly configured on that OAuth app and the mixed-environment risk has been reviewed.

After Vercel Production confirms `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` exist, record `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT` and redeploy before running authenticated admin/operator smoke.

Current production evidence, 2026-06-13:

- `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` are present in Vercel Production.
- `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT` is recorded in Vercel Production.
- Production was redeployed as `https://apex-lifespan-jgcomlj13-tom-chanpheng-s-projects.vercel.app` and aliased to `https://apex-lifespan.vercel.app`.
- Strict public database smoke passed after redeploy.
- Anonymous `/operator` renders the GitHub sign-in gate and remains closed to unauthenticated operators.

## Local Verification

Run these from the local checkout after environment setup is available:

```bash
npm run production:readiness
npm run production:migration-rehearsal
npm run production:migration-rehearsal -- --apply
npm run launch:readiness
```

If the approved non-production environment is available as an ignored local env file:

```bash
npm run production:readiness -- --env-file <non-production-env-file> --summary
npm run production:migration-rehearsal -- --env-file <non-production-env-file>
npm run production:migration-rehearsal -- --env-file <non-production-env-file> --apply
```

Record `APEX_MIGRATION_REHEARSAL_PASSED_AT` only after reviewing the non-production target and command results.

## Before Production Database Mode

- Verify Neon backups/PITR are enabled and recorded in operations readiness.
- Complete a non-production restore rehearsal.
- Confirm public smoke and browser QA pass in database mode.
- Confirm `/operator` remains closed to anonymous users.
- Confirm rollback steps are rehearsed for both Vercel app rollback and Neon data restore.
- Keep source-candidate promotion and operator writes human-reviewed and explicitly gated.
