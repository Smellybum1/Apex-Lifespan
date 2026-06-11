# Scheduled Ingestion Runner

## Goal

Advance scheduled source ingestion from planning-only to a guarded local runner that can process queued ingestion jobs with the same rate caps, while remaining fail-closed by default.

## Scope

- Keep `npm run ingest:scheduled-dry-run` read-only.
- Add a guarded `npm run ingest:scheduled-run` command that passes `--apply`.
- Require `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true`, `NCBI_TOOL`, and `NCBI_EMAIL` before running queued jobs.
- Run only bounded queued source-candidate ingestion jobs; no retries and no public promotion.
- Add tests with a mocked runner so validation does not call upstream APIs or mutate the database.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run ingest:scheduled-dry-run`
- `npm run ingest:scheduled-run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
