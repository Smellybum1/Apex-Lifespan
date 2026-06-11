# Scheduled Ingestion Hosted Run Gate

## Goal

Prepare the scheduler library for a future hosted cron route without exposing a hosted write endpoint yet.

## Scope

- Add an opt-in hosted-run readiness gate to `runScheduledSourceIngestionBatch`.
- Keep the local CLI runner behavior unchanged.
- Require hosted cron evidence and retry-policy readiness only when the hosted-run gate is explicitly requested.
- Keep scheduled ingestion bounded, source-candidate-only, and separate from public evidence promotion.
- Do not add a public route or cron configuration in this slice.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run ingest:scheduled-dry-run`
- fail-closed `npm run ingest:scheduled-run`
- `npm run launch:readiness`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
