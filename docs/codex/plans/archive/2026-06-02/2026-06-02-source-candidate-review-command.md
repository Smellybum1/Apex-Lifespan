# Source Candidate Review Command

## Goal

Add an operator-only local command mode to record human accept/reject decisions for source candidates after the pending queue has been reviewed.

## Constraints

- Keep public routes and UI unchanged.
- Do not auto-promote accepted candidates into curated evidence.
- Accepted candidates must include a curated `acceptedReferenceId`.
- Rejected candidates should clear any curated reference link through the existing helper.
- Review writes should apply only to candidates still pending review.
- Keep the command explicit and mutually exclusive with ingestion, queue, summary, jobs, and read-only candidate-list modes.

## Done Condition

- `npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>` records an accepted candidate.
- `npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note <note>` records a rejected candidate.
- Tests cover parsing, formatting, helper inputs, and mode conflicts.
- README and project memory document the operator-only review mode and citation guardrail.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- A command accept could be mistaken as evidence promotion; wording should keep it as source-candidate review only.
- The accepted reference ID must remain traceable to an existing curated reference.
