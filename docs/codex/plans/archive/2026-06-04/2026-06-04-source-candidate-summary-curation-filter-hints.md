# Source Candidate Summary Curation Filter Hints

## Goal

Add read-only status-filter command hints to summary curation handoff bucket rows so operators can jump from bucket counts to the matching filtered curation handoff view.

## Constraints

- Keep `--summary` read-only.
- Do not accept, reject, link claims, extract studies, create references, queue, run, or promote anything.
- Preserve curation readiness wording and manual-review gates.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Non-empty curation handoff summary bucket rows include a status-filtered handoff command hint.
- Empty curation handoff summary output stays compact.
- Tests cover the new summary bucket hints.
- Workflow docs and handoff mention the new hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --summary`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
