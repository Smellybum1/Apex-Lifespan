# Scheduled Ingestion Hosted Readiness

## Goal

Make hosted-cron readiness explicit without adding a public write endpoint or enabling unattended ingestion.

## Scope

- Extend the scheduled ingestion dry-run policy report with production runtime gates.
- Report missing hosted-cron evidence by variable name only.
- Keep the guarded local runner behavior unchanged.
- Keep automatic retries and public promotion disabled.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run ingest:scheduled-dry-run`
- fail-closed `npm run ingest:scheduled-run`
- `npm run typecheck`
- `npm run lint`
- `npm audit`
- `git diff --check`
