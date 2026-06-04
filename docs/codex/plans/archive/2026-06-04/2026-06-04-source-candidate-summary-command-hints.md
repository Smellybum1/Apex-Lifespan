# Source Candidate Summary Command Hints

## Goal

Add copyable read-only next-step commands to `--summary` so the workflow entry point tells operators how to move from counts into overview, duplicate scan, queued jobs, or curation handoff.

## Constraints

- Keep `--summary` read-only.
- Do not accept, reject, link, extract, queue, run, or promote anything.
- Use existing command surfaces only.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Summary output includes a compact read-only command hint section.
- Tests cover the new summary output.
- Workflow docs and handoff mention summary command hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --summary`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
