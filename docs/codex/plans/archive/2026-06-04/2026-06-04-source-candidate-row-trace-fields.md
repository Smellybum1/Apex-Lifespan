# Source Candidate Row Trace Fields

## Goal

Add query and ingestion-job trace fields to ordinary source-candidate list rows so operators can see the search context behind candidates returned from job-scoped or group-scoped lists.

## Constraints

- Keep candidate list output read-only.
- Do not accept, reject, link claims, extract studies, create references, queue, run, or promote anything.
- Preserve existing packet drill-in hints and manual-review gates.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Candidate list rows include `query="..."`.
- Candidate list rows include `ingestionJob=...` when available.
- Duplicate identity rows remain unchanged because they already include query and ingestion job context.
- Tests cover pending and reviewed candidate list rows.
- Workflow docs and handoff mention the trace fields.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidates --candidate-job-id cmpyzoc7500039jwcbu1ii4o7 --candidates-limit 3`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
