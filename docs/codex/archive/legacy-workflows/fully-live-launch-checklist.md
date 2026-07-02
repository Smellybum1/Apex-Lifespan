# Fully Live Launch Checklist

Reference-only legacy launch doc. Do not load during ordinary startup or local product work; use only when the user explicitly asks for a fully live production launch.

Last updated: 2026-06-12

Use this checklist only for the fully live production launch. The seed-backed public demo can remain live while these gates are incomplete.

## Preflight

- Confirm `git status -sb` is clean and the launch commit is known.
- Confirm Vercel production is linked to the intended GitHub branch.
- Run `npm run launch:readiness` and keep the report blocked until every external evidence item is real.
- Do not set `APEX_FULLY_LIVE_LAUNCH_APPROVED_AT` until every section below has evidence.

## Production Data

- Review `docs/codex/production-provisioning-checklist.md`.
- Create or verify the managed Neon production database and a non-production rehearsal database.
- Configure Vercel `DATABASE_URL` for the intended environments without committing secrets.
- Set `APEX_DATA_SOURCE=database` only after database connectivity and migrations are ready.
- Run `npm run production:migration-rehearsal -- --apply` against the non-production rehearsal target.
- Record `APEX_MIGRATION_REHEARSAL_PASSED_AT` only after reviewing the rehearsal output.
- Run `npm run db:migrate:deploy` for production through the approved deployment path.

## Operator Workflow

- Configure Auth.js and GitHub OAuth secrets in the managed environment.
- Bootstrap or verify at least one active operator account.
- Run `npm run operator:smoke -- <base-url>` and confirm anonymous `/operator` stays closed.
- Run non-production accept/reject, claim-link, extraction, fail-closed, and audit checks.
- Complete `docs/codex/operator-manual-qa-checklist.md`.
- Record `APEX_OPERATOR_ACTIVE_ACCOUNT_READY=true`, `APEX_OPERATOR_NONPROD_WRITE_QA_AT`, `APEX_OPERATOR_FLOW_QA_REVIEWED_AT`, and `APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT` only after QA evidence exists.

## Human Evidence Gates

- Keep source-candidate promotion human-owned and explicit.
- Complete claim link and structured extraction for accepted `PMID 42141930` before public promotion review.
- Run `npm run promotion:dry-run -- --pmid 42141930` and confirm no blockers before any promotion.
- Run `npm run coverage:review` and confirm launch coverage expectations are met with human-reviewed claims.
- Keep AU/TGA product-level evidence separate from ingredient-level evidence.

## Scheduled Ingestion

- Configure `NCBI_TOOL` and `NCBI_EMAIL`.
- Configure scheduled ingestion alerts and record `APEX_INGESTION_ALERTS_CONFIGURED=true`.
- Keep `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=false` until operator approval.
- Run `npm run ingest:scheduled-dry-run` and confirm rate limits, retry policy, and `noAutoPromotion=true`.
- Review `docs/codex/scheduled-ingestion-retry-policy.md` and record `APEX_INGESTION_RETRY_POLICY_APPROVED_AT` only after failed-job handling is understood.
- Set `APEX_SCHEDULED_INGESTION_CRON_APPROVED=true` only after hosted cron and alert evidence are reviewed.
- For approved ignored evidence files, use `npm run ingest:scheduled-dry-run -- --env-file <operations-env-file> --summary`.
- For any hosted-run apply rehearsal, use `npm run ingest:scheduled-run -- --env-file <operations-env-file> --require-hosted-run-readiness` and confirm the output still reports `automaticRetries=false` and `noAutoPromotion=true`.

## Operations Evidence

- Configure uptime monitoring and record `APEX_UPTIME_MONITORING_URL`.
- Configure error monitoring and record `APEX_ERROR_MONITORING_PROJECT`.
- Enable Vercel deployment alerts and record `APEX_DEPLOYMENT_ALERTS_CONFIGURED=true`.
- Enable Neon backups/PITR and record `APEX_DATABASE_BACKUPS_CONFIGURED=true`.
- Rehearse backup restore into non-production and record `APEX_BACKUP_RESTORE_REHEARSED_AT`.
- Rehearse rollback and record `APEX_ROLLBACK_DRILL_REHEARSED_AT`.
- Trigger an alert test and record `APEX_ALERT_TESTED_AT`.

## Launch QA

- Run `npm run test`.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm audit`.
- Run `npm run smoke:public-mvp -- <fully-live-url> --require-database` against the fully live production URL and record `APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT`.
- Smoke the authenticated operator flow in production and record `APEX_ADMIN_FLOW_SMOKE_PASSED_AT`.
- After the authenticated smoke has actually passed, preview the local evidence write with `npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence admin-flow-smoke --url <fully-live-url>/operator --note "<manual smoke note>" --summary`; add `--write` only after the note is reviewed.
- Run desktop and mobile browser QA in production database mode.
- Run accessibility and performance checks in production database mode.

## Approval And Follow-Up

- Re-run `npm run launch:readiness`; it must report `overall=ready`.
- Record `APEX_FULLY_LIVE_LAUNCH_APPROVED_AT` only after the ready report is reviewed.
- Confirm `docs/codex/post-launch-review-template.md` is ready for the 24-48 hour review.
- Schedule the 24-48 hour post-launch review and record `APEX_POST_LAUNCH_REVIEW_SCHEDULED_AT`.
- Preview post-launch review evidence with `npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence post-launch-review --review-window "<24-48 hour review window>" --note "<schedule note>" --summary`; add `--write` only after the review is scheduled.
- Preview final approval evidence with `npm run launch:evidence -- --env-file <ignored-evidence-env-file> --evidence launch-approval --approved-by <approver> --note "<approval note>" --summary`; add `--write` only after explicit approval and readiness review.
- Track post-launch issues in the handoff or the next roadmap after rollover.
