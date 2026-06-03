# Source Candidate Review Queue Command

## Goal

Add read-only local command visibility into pending source candidates so operators can inspect candidate titles, URLs, triage scores, and dedupe keys before review.

## Constraints

- Keep public routes and UI unchanged.
- Read-only command mode only; do not accept or reject candidates in this slice.
- Default to pending-review candidates and label scores as triage, not evidence quality.
- Keep output bounded and optionally filter by PubMed or ClinicalTrials.gov.

## Done Condition

- `npm run ingest:sources -- --candidates` prints pending source-candidate review queue rows.
- `--candidates-limit <count>` caps output.
- `--candidate-source <pubmed|clinical-trials>` filters output.
- Tests cover parser behavior, output formatting, empty state, and mode conflicts.
- README and project memory document the operator-only candidate list mode.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Triage scores can be mistaken for evidence quality; command output and docs should preserve workflow wording.
