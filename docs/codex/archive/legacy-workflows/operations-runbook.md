# Operations Runbook

Reference-only legacy launch doc. Do not load during ordinary startup or local product work; use only when the user explicitly asks for production operations or launch evidence.

Last updated: 2026-06-12

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
npm run operations:readiness -- --env-file <operations-env-file> --summary
```

The report is read-only. It checks that the local privacy page, terms page, public `/api/health` endpoint, this runbook, and `docs/codex/operations-drill-checklist.md` exist, then reports whether external operations proof has been recorded through evidence variables. It prints variable names and sanitized URLs only; do not store monitoring tokens, API keys, or database credentials in the report.

Use the `--env-file` form for an approved ignored local evidence file such as `.env.vercel.preview.local`; do not paste secret values into shell history or committed docs.

External proof variables:

- `APEX_UPTIME_MONITORING_URL`
- `APEX_ERROR_MONITORING_PROJECT`
- `APEX_DEPLOYMENT_ALERTS_CONFIGURED=true`
- `APEX_INGESTION_ALERTS_CONFIGURED=true`
- `APEX_DATABASE_BACKUPS_CONFIGURED=true`
- `APEX_BACKUP_RESTORE_REHEARSED_AT`
- `APEX_ROLLBACK_DRILL_REHEARSED_AT`
- `APEX_ALERT_TESTED_AT`

`APEX_UPTIME_MONITORING_URL` should be a sanitized http(s) monitor URL only. Do not include credentials, query strings, fragments, local hosts, monitor tokens, or API keys.

## Monitoring

Required before fully-live launch:

- Lightweight uptime check for `/api/health` on the production domain.
- Full-page smoke coverage for `/` on the production domain.
- Error alerting for Next.js server errors and failed public API route responses.
- Deployment failure alerts from Vercel.
- Scheduled ingestion failure alerts once hosted cron is enabled.
- Manual alert test recorded in the launch notes.

Recommended minimum alert destinations:

- Operator email or team inbox for deployment failures.
- Operator email or team inbox for uptime failures.
- Private operator channel for ingestion failures and curation queue drift.

Latest alert test evidence:

- Timestamp: `2026-06-12T06:54:22Z`.
- GitHub Actions repository execution was enabled for `Smellybum1/Apex-Lifespan` before the successful test run.
- Workflow: `Launch Alert Test`, added on `main` at `8a9f642`.
- Evidence run: `https://github.com/Smellybum1/Apex-Lifespan/actions/runs/27399894930`.
- Result: completed with the expected intentional `failure` conclusion to trigger the launch-safe alert path.
- Scope: no checkout, deployment, database write, ingestion write, source promotion, or operator write.
- Note: two earlier dispatches were created while GitHub Actions was disabled and remained queued; GitHub returned server errors when asked to force-cancel them, so they are not used as alert evidence.

## Database Backups

Required before database mode launch:

- Neon point-in-time restore enabled for the production database.
- Manual logical export captured before first production migration.
- Restore rehearsal completed into a non-production database.
- `npm run db:migrate:deploy` rehearsed against non-production before production.
- Rollback note that separates Vercel deployment rollback from database restore.

Current managed backup/PITR coverage evidence:

- Vercel project `apex-lifespan` has the Neon Marketplace resource `neon-fuchsia-village` connected.
- Neon dashboard evidence shows project history retention set to 6 hours.
- Restore ownership sits with the Vercel/Neon project owner through the Neon Console.
- `APEX_DATABASE_BACKUPS_CONFIGURED=true` records only managed PITR coverage; restore rehearsal and rollback drill evidence remain separate launch blockers.

Restore rehearsal evidence should include:

- Source database name and restore target name.
- Restore timestamp.
- Migration version before and after restore.
- Public smoke result against the restored target.
- Operator who verified the result.

Latest restore rehearsal evidence:

- Timestamp: `2026-06-12T06:30:14.1738788Z`.
- Source database: Preview Neon `neondb`.
- Restore target: temporary Neon database `apex_restore_rehearsal_20260612062621`.
- Migration validation: `npm run db:migrate:deploy` applied all 4 committed migrations to the target.
- Data validation: copied 18 application tables with row-count parity, including 5 interventions, 7 claims, 9 references, 5 studies, 4 safety alerts, 2 products, and 7 AU regulatory status rows.
- App data smoke: restored target returned `dataSource: database` through the dashboard data path.
- Cleanup: temporary restore database was dropped; no `apex_restore_rehearsal_*` databases remained after cleanup.
- Operator: Codex, using the approved local evidence file and non-production Preview Neon target.

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

Latest rollback drill evidence:

- Timestamp: `2026-06-12T06:33:48.8062715Z`.
- Current production deployment: `https://apex-lifespan-8jobww3fi-tom-chanpheng-s-projects.vercel.app`, id `dpl_BCYNTeCWeGMbTFsfsEu7hToKxLBz`, Ready.
- App rollback target: previous Ready production deployment `https://apex-lifespan-9msbgyge0-tom-chanpheng-s-projects.vercel.app`, id `dpl_AaFPxRc6F4p2HYtw1iTd6qWso2iW`.
- Rollback command shape confirmed without execution: `vercel rollback <deployment id/url>`.
- Rollback status check: no deployment rollback in progress.
- Data rollback path: use Neon point-in-time restore or the latest verified export; the non-production restore rehearsal passed and the temporary restore target was cleaned up.
- Public smoke after the rehearsal passed against `https://apex-lifespan.vercel.app`.
- No production traffic rollback or database restore was executed during this drill.

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
