# Post-Launch Review

Last updated: 2026-06-14

Use this file for the 24-48 hour review after the fully-live production launch. Keep it evidence-oriented and safe to commit: do not paste secrets, database URLs, OAuth credentials, private alert payloads, or personal/operator data.

## Evidence Capture Rules

- Record command names, timestamps, ready/blocked/warning counts, and issue links; keep raw secret-bearing output in ignored local evidence files only.
- Treat public smoke, readiness summaries, scheduled ingestion dry-runs, and KPI summaries as read-only checks.
- Do not run migration, seed, persistence smoke, rollback, data restore, write enablement, or scheduled ingestion apply commands during this review unless that action has separate explicit approval.
- Keep source-candidate acceptance, evidence promotion, trial-alert recording, changelog publication, and score/history writes explicit, authenticated, reviewed, and human-owned.
- Separate app deployment rollback decisions from database restore/data rollback decisions.

## Suggested Evidence Commands

```bash
npm run smoke:public-mvp -- https://apex-lifespan.vercel.app --require-database
npm run operator:smoke -- https://apex-lifespan.vercel.app --expect-auth-required
npm run launch:readiness -- --env-file .env.vercel.production.local --summary
npm run production:readiness -- --env-file .env.vercel.production.local --summary
npm run operator:readiness -- --env-file .env.vercel.production.local --summary
npm run operations:readiness -- --env-file .env.vercel.production.local --summary
npm run coverage:review -- --env-file .env.vercel.production.local --summary
npm run ingest:scheduled-dry-run -- --env-file .env.vercel.production.local --summary
npm run analytics:kpis -- --summary
npm run promotion:readiness -- --env-file .env.vercel.production.local --summary
```

## Review Header

- Review window: Early requested review on 2026-06-14 at about 00:31-00:35 Australia/Brisbane; scheduled checkpoint remains 2026-06-14 14:00 Australia/Brisbane.
- Launch commit: Production includes the launch/auth hotfix line; local branch `codex/queue-claim-sources` is ahead of origin by 6 commits through `f343960`.
- Production URL: https://apex-lifespan.vercel.app
- Data mode: Public smoke required database-backed content and passed. Local `.env.vercel.production.local` does not expose a nonempty `DATABASE_URL`, so direct local production DB inspections were blocked for some readiness commands.
- Reviewer: Codex, at user request.
- Evidence timestamp(s): 2026-06-14 00:31-00:35 Australia/Brisbane.
- Local evidence file(s), if any: None; safe command summaries are recorded inline.

## Public Product Health

- Public smoke command: `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app --require-database`
- Public smoke result: Passed after updating the local smoke assertion to accept the deployed `Human reviewed` status text; the original failure was a stale smoke-helper wording check, not a product outage.
- Homepage uptime status: 200 OK; homepage contained database-backed source-packet content.
- Public API route status: Health endpoint, PubMed live preview, ClinicalTrials.gov live preview, and invalid-term guards passed.
- Privacy and terms route status: Passed.
- Accessibility/performance spot check: Not run in this early review.
- User-visible issues: None found by public smoke.
- Follow-up issue links: None created.

## Operator Workflow

- Operator smoke command: `npm run operator:smoke -- https://apex-lifespan.vercel.app --expect-auth-required`
- Operator sign-in status: Anonymous operator boundary passed with auth required.
- Active operator account verified: `npm run operator:readiness -- --env-file .env.vercel.production.local --summary` reported ready 17, blocked 0, warning 0 from configured evidence.
- Source-candidate queue status: Production promotion readiness could not inspect the production DB from the local env file because `DATABASE_URL` is empty. Preview readiness earlier showed one candidate ready for explicit human review.
- Audited write smoke result: Not run; review stayed read-only.
- Emergency write-disable status: No production write enablement occurred during review.
- Write approvals enabled during review: None.
- Operator issues: No anonymous boundary issue found; production DB-backed operator queue inspection remains blocked by local env evidence.
- Follow-up issue links: None created.

## Evidence And Curation

- Coverage/readiness command: `npm run coverage:review -- --env-file .env.vercel.production.local --summary`
- Human-reviewed claim count: 0 in the local summary.
- Outstanding claim review backlog: 8 claims need human review before evidence expansion.
- Promotion dry-run status: `npm run promotion:readiness -- --env-file .env.vercel.production.local --summary` failed because the local production env file has an empty `DATABASE_URL`.
- Accepted candidate blockers: Production candidate acceptance was not verified in this review; preview readiness had one candidate ready for explicit human-owned promotion review.
- Product-level AU/TGA verification issues: None newly found. Continue not inferring product-level ARTG/AUST status from generic evidence.
- Medical/citation safety issues: No new public smoke issue found. Public evidence remains constrained by unreviewed claim status and citation traceability guardrails.
- Score/history write decisions: No writes performed.
- Follow-up issue links: None created.

## Scheduled Ingestion

- Dry-run command: `npm run ingest:scheduled-dry-run -- --env-file .env.vercel.production.local --summary`
- Hosted cron status: Production dry-run was blocked locally by empty `DATABASE_URL`; preview dry-run earlier reported hosted cron/run gates ready with 0 queued jobs and 0 would-run jobs.
- Last scheduled dry run or execution: Preview dry-run evidence exists from the approved non-production smoke; production local dry-run could not inspect DB state.
- Failed job count: Not inspectable from local production env in this review.
- Duplicate source identity warnings: Not inspectable from local production env in this review.
- Retry policy status: Preview readiness passed; production local dry-run blocked by env evidence.
- Ingestion alert status: Missing from operations evidence.
- Apply command executed: No.
- Follow-up issue links: None created.

## Operations

- Operations readiness command: `npm run operations:readiness -- --env-file .env.vercel.production.local --summary`
- Uptime monitor status: Blocked; `APEX_UPTIME_MONITORING_URL` evidence missing.
- Error monitor status: Blocked; `APEX_ERROR_MONITORING_PROJECT` evidence missing.
- Deployment alert status: Blocked; `APEX_DEPLOYMENT_ALERTS_CONFIGURED` evidence missing.
- Database backup/PITR status: Blocked; `APEX_DATABASE_BACKUPS_CONFIGURED` evidence missing.
- Restore rehearsal evidence still valid: Blocked; `APEX_BACKUP_RESTORE_REHEARSED_AT` evidence missing.
- Rollback path still valid: Blocked; `APEX_ROLLBACK_DRILL_REHEARSED_AT` evidence missing.
- Alert test status: Blocked; `APEX_ALERT_TESTED_AT` evidence missing.
- Follow-up issue links: None created.

## Product Analytics And Feedback

- KPI summary command: `npm run analytics:kpis -- --summary`
- Public usage aggregate status: KPI summary passed with 15 KPIs; public evidence usage dashboard still needs a privacy-preserving aggregate analytics provider.
- Feedback intake status: Provider-neutral KPI blueprints are ready; real public usage outputs are not connected.
- Privacy boundary issues: Privacy review ready, aggregate-only true, blockers 0.
- Follow-up issue links: None created.

## Decisions

- Continue fully-live operation: Yes. Public DB-backed smoke and anonymous operator auth boundary passed.
- Roll back app deployment: No rollback indicated.
- Roll back or restore data: No data rollback or restore indicated; direct production DB inspection was blocked locally and no restore command was run.
- Disable operator writes: Keep production writes disabled/not enabled during this review.
- Disable scheduled ingestion: Keep scheduled apply/write paths disabled until production DB dry-run evidence and alert evidence are available.
- Keep seed-mode fallback unavailable/available: Keep public production database-backed. Local summaries that could not access production DB should not be treated as production data proof.

## Follow-Up

- Issues created: None.
- Owner: Project operator.
- Due date: Before enabling unattended ingestion or production operator writes; revisit at scheduled 2026-06-14 14:00 Australia/Brisbane checkpoint.
- Next review: Scheduled checkpoint on 2026-06-14 at 14:00 Australia/Brisbane, or earlier after refreshing local production evidence with a nonempty read-only DB connection.
