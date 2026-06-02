# Source Candidate Curation Handoff Status Filter

## Goal
Let operators filter the read-only curation handoff list by readiness status after `--summary` shows which handoff states need attention.

## Constraints
- Keep this under `npm run ingest:sources -- --candidate-curation-handoff`.
- Do not mutate source candidates, curated references, claim links, studies, or public routes.
- Reuse existing curation status wording.
- Keep output framed as curation handoff readiness, not evidence quality.

## Done Condition
- Data helper can filter derived handoff rows by readiness status.
- CLI parses a bounded status filter with clear accepted names.
- Tests cover status parsing, isolation, and filtered handoff rows.
- README and project memory document the filter.

## Files Likely Touched
- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Validation
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Filter names should be operator-friendly but still map exactly to tested status labels.
