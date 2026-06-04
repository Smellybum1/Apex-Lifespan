# Source Candidate Packet Command Hints

## Goal

Add copyable command hints to read-only source-candidate review packets so an operator can continue inspection or make an explicit human-reviewed decision without reconstructing flags.

## Constraints

- Do not execute or automate accept/reject/link/extract decisions.
- Keep public routes unchanged and source-candidate workflow local-only.
- Preserve triage-score wording as review triage, not evidence quality.
- Keep write templates clearly marked as human-reviewed operator actions.

## Acceptance

- Review packets include read-only follow-up commands for detail, reference matches, siblings, and filtered group listing.
- Review packets include accept/reject templates only as explicit human-reviewed operator actions.
- Tests cover packet output wording and command shape.
- Workflow docs and handoff mention the packet command hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-packet <dedupe-key>`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts src/lib/data/source-candidates.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
