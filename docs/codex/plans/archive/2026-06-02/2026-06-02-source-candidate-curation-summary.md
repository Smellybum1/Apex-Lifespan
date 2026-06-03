# Source Candidate Curation Summary

## Goal
Add read-only curation readiness counts to the local source-candidate summary so operators can see accepted-candidate handoff state before drilling into individual rows.

## Constraints
- Keep this under `npm run ingest:sources -- --summary`.
- Do not mutate source candidates, curated references, claim links, studies, or public routes.
- Reuse existing curation status wording.
- Keep output framed as operator workflow readiness, not evidence quality.

## Done Condition
- Backend helper summarizes accepted source-candidate curation handoff statuses.
- `--summary` prints backlog counts plus curation handoff counts.
- Tests cover empty and mixed readiness counts.
- README and project memory document the expanded summary.

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
- Derived curation counts can be mistaken for evidence quality; wording should keep them as handoff readiness.
