# Source Candidate Job Row Hints

## Goal

Add read-only command hints to source-candidate job rows so operators can jump from `--jobs` output to the candidates from a job, same-context jobs, and same-status jobs without reconstructing filters.

## Constraints

- Keep `--jobs` read-only.
- Do not run, queue, accept, reject, link claims, extract studies, create references, or promote anything.
- Emit only list/inspect follow-up commands, not run templates.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Non-empty job rows include read-only candidate-list, same-context-jobs, and same-status-jobs hints.
- Empty job output stays compact.
- Tests cover job rows with context, failed rows, and queued status-filtered rows.
- Workflow docs and handoff mention the new hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --jobs --jobs-limit 3`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
