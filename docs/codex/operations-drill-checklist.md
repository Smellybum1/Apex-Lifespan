# Operations Drill Checklist

Last updated: 2026-06-11

## Purpose

Use this checklist to collect the external operations proof required before the fully-live database-backed launch. It is human-owned and read-only: complete the drills in the hosting, monitoring, and database consoles, then record only safe evidence variables or brief notes in the launch handoff.

Do not paste secrets, monitor tokens, database URLs, OAuth secrets, raw alert payloads, or private customer/operator data into this file.

## Before Starting

- Confirm the target is the production domain or the named non-production rehearsal environment.
- Confirm the current branch and commit with `git status -sb` and `git log -3 --oneline`.
- Confirm public routes stay read-only and operator writes are disabled unless the drill explicitly requires a non-production write test.
- Confirm database restore drills target a non-production database.

## Drill Order

1. Uptime monitoring
   - Create or verify an uptime check for `/` on the production domain.
   - Confirm the check target does not include a private token.
   - Record a sanitized monitor URL in `APEX_UPTIME_MONITORING_URL`.

2. Error monitoring
   - Create or verify server/API error monitoring for the deployed Next.js app.
   - Trigger or inspect a non-sensitive test event if the provider supports it.
   - Record the project identifier in `APEX_ERROR_MONITORING_PROJECT`.

3. Deployment alerts
   - Enable Vercel deployment failure alerts for the production project.
   - Confirm the alert destination reaches the operator inbox or channel.
   - Record `APEX_DEPLOYMENT_ALERTS_CONFIGURED=true`.

4. Scheduled ingestion alerts
   - Configure failure alerts for hosted ingestion before enabling unattended scheduled writes.
   - Confirm alert routing without retrying or promoting source candidates automatically.
   - Record `APEX_INGESTION_ALERTS_CONFIGURED=true`.

5. Database backups
   - Confirm managed backup or point-in-time restore coverage for the production database.
   - Confirm the retention window and restore ownership are known.
   - Record `APEX_DATABASE_BACKUPS_CONFIGURED=true`.

6. Backup restore rehearsal
   - Restore production-like data into a non-production database.
   - Run migrations or smoke checks against the restore target only after review.
   - Record the rehearsal timestamp in `APEX_BACKUP_RESTORE_REHEARSED_AT`.

7. Rollback drill
   - Identify the last known good Vercel deployment.
   - Confirm the data rollback path separately from the app rollback path.
   - Run public smoke after the rehearsal.
   - Record the drill timestamp in `APEX_ROLLBACK_DRILL_REHEARSED_AT`.

8. Alert test
   - Send or trigger a launch-safe alert test.
   - Confirm the operator receives it and knows the next action.
   - Record the test timestamp in `APEX_ALERT_TESTED_AT`.

## Final Local Check

Run:

```bash
npm run operations:readiness
npm run launch:readiness
```

The operations report should show the local artifacts ready and no missing external operations evidence. If it remains blocked, use the first `nextEvidenceAction` as the next operator task.
