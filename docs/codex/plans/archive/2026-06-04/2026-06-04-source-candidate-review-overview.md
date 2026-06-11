# Source Candidate Review Overview

## Goal

Add a read-only local CLI overview that helps an operator choose source-candidate review packets without accepting, rejecting, linking, extracting, or promoting candidates.

## Constraints

- Keep all writes under existing explicit review/curation commands only.
- Do not add public routes or dashboard behavior.
- Preserve `/100` wording as triage scores, not evidence quality.
- Keep peptide/regulatory guardrails intact.

## Acceptance

- CLI has a bounded read-only overview for pending candidates grouped by claim/source.
- Output highlights counts and top candidate keys for follow-up review packets.
- Tests cover parser isolation, output wording, and data helper grouping.
- Handoff/docs mention the new read-only overview.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
