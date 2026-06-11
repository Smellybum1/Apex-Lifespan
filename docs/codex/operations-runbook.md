# Operations Runbook

Last updated: 2026-06-11

## Scope

This runbook covers the fully-live Apex Lifespan public product. It is intentionally operational and proof-oriented: each item should produce evidence before launch is called complete.

## Current Status

- Public MVP/demo: `https://apex-lifespan.vercel.app`.
- Current public mode: seed-backed demo.
- Fully-live target mode: managed PostgreSQL with `APEX_DATA_SOURCE=database`.
- Public routes remain read-only.
- Operator writes remain authenticated, explicit, audited, and disabled by default with `APEX_OPERATOR_WRITES_ENABLED=false`.

## Local Readiness Report

Run this before launch evidence review:

```bash
npm run operations:readiness
```

The report is read-only. It checks that the local privacy page, terms page, this runbook, and `docs/codex/operations-drill-checklist.md` exist, then reports whether external operations proof has been recorded through evidence variables. It prints variable names and sanitized URLs only; do not store monitoring tokens, API keys, or database credentials in the report.

External proof variables:

- `APEX_UPTIME_MONITORING_URL`
- `APEX_ERROR_MONITORING_PROJECT`
- `APEX_DEPLOYMENT_ALERTS_CONFIGURED=true`
- `APEX_INGESTION_ALERTS_CONFIGURED=true`
- `APEX_DATABASE_BACKUPS_CONFIGURED=true`
- `APEX_BACKUP_RESTORE_REHEARSED_AT`
- `APEX_ROLLBACK_DRILL_REHEARSED_AT`
- `APEX_ALERT_TESTED_AT`

## Monitoring

Required before fully-live launch:

- Uptime check for `/` on the production domain.
- Error alerting for Next.js server errors and failed public API route responses.
- Deployment failure alerts from Vercel.
- Scheduled ingestion failure alerts once hosted cron is enabled.
- Manual alert test recorded in the launch notes.

Recommended minimum alert destinations:

- Operator email or team inbox for deployment failures.
- Operator email or team inbox for uptime failures.
- Private operator channel for ingestion failures and curation queue drift.

## Database Backups

Required before database mode launch:

- Neon point-in-time restore enabled for the production database.
- Manual logical export captured before first production migration.
- Restore rehearsal completed into a non-production database.
- `npm run db:migrate:deploy` rehearsed against non-production before production.
- Rollback note that separates Vercel deployment rollback from database restore.

Restore rehearsal evidence should include:

- Source database name and restore target name.
- Restore timestamp.
- Migration version before and after restore.
- Public smoke result against the restored target.
- Operator who verified the result.

## Deployment Rollback

Rollback paths:

- App rollback: use Vercel deployment rollback to the last known good deployment.
- Data rollback: use Neon point-in-time restore or restore from the latest verified export.
- Emergency write disable: set `APEX_OPERATOR_WRITES_ENABLED=false` and redeploy or refresh runtime config.
- Public safety fallback: set `APEX_DATA_SOURCE=seed` only for an intentional public demo fallback, not to mask a production database outage.

Minimum drill before launch:

- Confirm the last known good deployment can be identified.
- Confirm a rollback deployment can be selected in Vercel.
- Confirm the database restore process is documented and assigned.
- Run public smoke after the rollback rehearsal.

## Privacy And Terms

Public routes:

- `/privacy`
- `/terms`

The pages must stay aligned with these product rules:

- No individualized medical advice.
- Public dashboard is read-only.
- Live source previews are unreviewed research leads.
- AU/TGA status is product-specific.
- Peptide sourcing, compounding, reconstitution, injection, cycling, dosing, and self-administration guidance stay out of scope.

## Launch Evidence Checklist

Record these before fully-live launch:

- Complete the human-owned drill order in `docs/codex/operations-drill-checklist.md`.
- `git status -sb`
- `git log -3 --oneline`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm audit`
- `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app`
- Production `APEX_DATA_SOURCE=database` confirmation.
- Managed database migration result.
- Uptime alert test result.
- Deployment alert test result.
- Backup restore rehearsal result.
- Operator auth smoke result.
- Scheduled ingestion dry run or hosted cron smoke result.
- `APEX_SCHEDULED_INGESTION_CRON_APPROVED=true` evidence before enabling hosted cron.
