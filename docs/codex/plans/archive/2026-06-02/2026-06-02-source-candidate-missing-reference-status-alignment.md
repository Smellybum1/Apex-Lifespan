# Source Candidate Missing Reference Status Alignment

## Goal

Make single-candidate curation status report the same accepted-reference-missing state as the curation handoff list when an accepted candidate has no accepted reference id.

## Constraints

- Keep the command read-only and operator-only.
- Do not promote candidates, create references, or change review decisions.
- Preserve pending/rejected candidates as `Not accepted`.
- Keep wording framed as curation handoff readiness, not evidence quality.

## Done Condition

- Accepted candidates without an accepted reference id return `Accepted reference missing`.
- Pending/rejected candidates still return `Not accepted`.
- Regression coverage proves the single-status and list-status behavior are aligned.
- Project memory records the curation-status consistency rule.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

## Risks

- Do not relabel genuinely pending or rejected candidates as curation gaps.
- Avoid implying the missing reference is public evidence.
