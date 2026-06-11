# Production Data Architecture

Status: selected for the fully live roadmap on 2026-06-11. Provisioning and secret entry remain operator actions.

## Decision

Use managed Neon Postgres through the Vercel Marketplace for the first fully live database-backed release.

Rationale:

- The app is already deployed on Vercel, and Vercel now connects Postgres through Marketplace integrations rather than new Vercel Postgres stores.
- Neon is the Vercel-native Postgres Marketplace path and supports branching, autoscaling, point-in-time restore, and Vercel environment variable injection.
- The codebase already uses Prisma/PostgreSQL locally, so the production path should preserve `DATABASE_URL`, Prisma migrations, and the existing dashboard data boundary instead of adding a second database technology.

## Region

Initial production region: AWS US East (N. Virginia), `aws-us-east-1`.

Reasoning: choose the database region closest to the application server for the first managed deployment. Current Vercel production is not explicitly pinned to an Australia runtime region, so the first database should stay in the common Vercel/US-East path unless runtime region pinning is introduced deliberately.

If the app later pins serverless/runtime work to Australia or the audience shifts toward Australia-only latency, create a new Neon project in AWS Asia Pacific (Sydney), `aws-ap-southeast-2`, and migrate data. Neon project region is selected at project creation and should be treated as a one-way infrastructure decision.

## Environments

- Local: Docker Compose PostgreSQL from `.env.example`, `APEX_DATA_SOURCE=auto`.
- Preview/staging: Neon non-production branch or separate Neon project, Vercel Preview-scoped `DATABASE_URL`, `APEX_DATA_SOURCE=database`.
- Production: Neon production branch/project, Vercel Production-scoped `DATABASE_URL`, `APEX_DATA_SOURCE=database`.

Keep `APEX_CODEX_THREAD_ID`, `APEX_CODEX_REVIEW_TOKEN`, and other Codex sidecar variables out of Vercel Preview and Production.

## Migration Policy

- Local development uses `npm run db:migrate` to create committed Prisma migrations.
- Staging/preview rehearsal uses `npm run db:migrate:deploy` against a non-production Neon database before production.
- Production uses `npm run db:migrate:deploy` only after the same migration has passed staging/preview rehearsal.
- Do not use `npm run db:push` against managed staging or production databases.
- Do not rely on public seed fallback in production database mode. Production should use `APEX_DATA_SOURCE=database` so missing or broken `DATABASE_URL` fails closed.

## Backup And Restore

- Enable Neon point-in-time restore with the longest restore window available on the selected plan before public database mode is enabled.
- Before production cutover, perform at least one restore rehearsal into a non-production branch/project.
- Add exported `pg_dump` backups to external storage before onboarding irreplaceable reviewed evidence or operator audit data.
- Treat rollback as both app rollback and data rollback: Vercel rollback restores code; Neon restore/branch promotion restores data.

## Provisioning Checklist

Detailed operator checklist: `docs/codex/production-provisioning-checklist.md`.

1. Install or link Neon in the Vercel Marketplace for the Apex Lifespan project.
2. Create production and non-production database targets.
3. Set Vercel Preview and Production environment variables with environment-specific `DATABASE_URL` values.
4. Set `APEX_DATA_SOURCE=database` only after staging migration and smoke checks pass.
5. Run `npm run db:validate` locally and `npm run db:migrate:deploy` against the non-production managed database.
6. Seed/import reviewed production-ready data through explicit operator workflow only.
7. Run public smoke and database-mode browser QA before switching production traffic to database mode.

## References

- Vercel Postgres docs: https://vercel.com/docs/postgres
- Vercel Neon Marketplace integration: https://vercel.com/marketplace/neon
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Neon regions: https://neon.com/docs/introduction/regions
- Neon backups: https://neon.com/docs/manage/backups
- Prisma production migrations: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
