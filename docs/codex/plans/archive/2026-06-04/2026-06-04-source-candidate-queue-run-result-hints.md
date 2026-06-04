# Source Candidate Queue Run Result Hints

## Goal

Add read-only follow-up command hints to queue and run result output so an operator can inspect candidates, same-context jobs, and same-status jobs after an intentional queue or run command.

## Constraints

- Do not add run, queue, accept, reject, claim-link, extraction, reference-creation, or promotion templates.
- Keep queue and run actions explicit and operator-owned.
- Validate queue/run result formatting through tests; do not run live write commands for QA.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Queue result rows include read-only candidate-list, context-jobs, and status-jobs hints.
- Run result rows include read-only candidate-list, context-jobs, and status-jobs hints.
- Existing queued-job/context-mismatch output keeps its warnings and gains only read-only follow-ups.
- Tests cover queued, existing, claim-queued, succeeded-run, and failed-run outputs.
- Workflow docs and handoff mention the post-action read-only hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --jobs --jobs-limit 2`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
