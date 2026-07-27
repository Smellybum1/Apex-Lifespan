# Scheduled Ingestion Failure Review

## Goal

Make retry policy review concrete without enabling automatic retries or requeueing failed jobs.

## Scope

- Add a read-only failure review section to `npm run ingest:scheduled-dry-run`.
- Classify recent failed ingestion jobs into retry-review categories.
- Avoid printing raw failed-job error text in the scheduler dry-run report.
- Keep `automaticRetries=false` and `retryAutomationReady=false`.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run ingest:scheduled-dry-run`
- fail-closed `npm run ingest:scheduled-run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
