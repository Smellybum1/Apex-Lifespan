# Live Source API Read-Only Boundary Test

## Goal
Add a regression test that keeps public live-source API routes from importing or using source-candidate persistence helpers.

## Constraints
- Public MVP routes remain read-only.
- Source-candidate ingestion and review stay local/operator-only.
- Keep the test lightweight and static; do not call external APIs or databases.

## Done Condition
- A Vitest test scans `src/app/api` route files for source-candidate persistence imports/usages.
- Project memory records the guardrail.
- Targeted and broad checks pass.

## Files Likely Touched
- `src/app/api/live-source-readonly-boundary.test.ts`
- `docs/codex/project.md`

## Steps
1. Add a small recursive route-file scan test for `src/app/api`.
2. Assert disallowed source-candidate data imports and Prisma write surfaces are absent.
3. Update Codex project memory.
4. Run targeted and broad validation.

## Validation
- `npm run test -- src/app/api/live-source-readonly-boundary.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Static tests can be too broad; keep patterns specific to source-candidate persistence boundaries.
