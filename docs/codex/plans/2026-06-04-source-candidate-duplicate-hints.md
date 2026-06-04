# Source Candidate Duplicate Hints

## Goal

Add copyable read-only command hints to duplicate identity output so operators can inspect duplicate PMID/NCT contexts through review packets without reconstructing flags.

## Constraints

- Keep duplicate handling read-only; do not accept, reject, merge, link, or promote candidates.
- Keep review decisions explicit and human-owned.
- Preserve source-candidate wording and triage-score framing.
- Do not touch public routes or dashboard behavior.

## Acceptance

- Duplicate identity group headings include a read-only filtered duplicate-list command.
- Duplicate candidate rows include a packet command for candidate-specific review.
- Tests cover the command shapes.
- Workflow docs and handoff mention duplicate hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidates --candidate-duplicates`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
