# Scheduled Ingestion Policy Review

## Goal

Advance scheduled source ingestion by making rate-limit, retry, and upstream metadata policy visible in the dry-run report before hosted cron is enabled.

## Scope

- Add a structured policy review to `npm run ingest:scheduled-dry-run`.
- Keep the command read-only: no queueing, running, retrying, accepting, rejecting, or promotion.
- Report source caps and missing NCBI metadata by variable name only.
- Update scheduler tests and design docs.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run ingest:scheduled-dry-run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
