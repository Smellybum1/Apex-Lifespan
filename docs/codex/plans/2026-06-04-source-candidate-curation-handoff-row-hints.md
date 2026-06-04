# Source Candidate Curation Handoff Row Hints

## Goal

Add read-only per-row command hints to curation handoff output so operators can jump from a handoff row to packet, reference-match, status, and draft views without reconstructing commands.

## Constraints

- Keep curation handoff output read-only.
- Do not accept, reject, link claims, extract studies, create references, queue, run, or promote anything.
- Preserve curation readiness wording and manual-review gates.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Non-empty curation handoff rows include packet, reference-match, curation-status, and curation-draft hints.
- Empty curation handoff output stays compact and unchanged.
- Tests cover the new handoff row hints.
- Workflow docs and handoff mention the new hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-curation-handoff`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
