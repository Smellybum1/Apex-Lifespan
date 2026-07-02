# Post-Launch Review Template

Last updated: 2026-06-11

Use this template for the 24-48 hour review after the fully-live production launch. Keep it evidence-oriented and safe to commit: do not paste secrets, database URLs, OAuth credentials, private alert payloads, or personal/operator data.

## Review Header

- Review window:
- Launch commit:
- Production URL:
- Data mode:
- Reviewer:

## Public Product Health

- Public smoke result:
- Homepage uptime status:
- Public API route status:
- Privacy and terms route status:
- Accessibility/performance spot check:
- User-visible issues:

## Operator Workflow

- Operator sign-in status:
- Active operator account verified:
- Source-candidate queue status:
- Audited write smoke result:
- Emergency write-disable status:
- Operator issues:

## Evidence And Curation

- Human-reviewed claim count:
- Outstanding claim review backlog:
- Promotion dry-run status:
- Accepted candidate blockers:
- Product-level AU/TGA verification issues:
- Medical/citation safety issues:

## Scheduled Ingestion

- Hosted cron status:
- Last scheduled dry run or execution:
- Failed job count:
- Duplicate source identity warnings:
- Retry policy status:
- Ingestion alert status:

## Operations

- Uptime monitor status:
- Error monitor status:
- Deployment alert status:
- Database backup/PITR status:
- Restore rehearsal evidence still valid:
- Rollback path still valid:
- Alert test status:

## Decisions

- Continue fully-live operation:
- Roll back app deployment:
- Roll back or restore data:
- Disable operator writes:
- Disable scheduled ingestion:
- Keep seed-mode fallback unavailable/available:

## Follow-Up

- Issues created:
- Owner:
- Due date:
- Next review:
