# Source Candidate Curation Status Limit

## Goal

Make `--candidate-curation-handoff --candidate-curation-handoff-status ...` apply the derived readiness status filter before the display row limit so operators do not miss matching rows beyond the first unfiltered page.

## Constraints

- Keep the command read-only and local/operator-only.
- Preserve existing status names, aliases, ordering, and output format.
- Keep the default and maximum displayed handoff row limits.
- Avoid public route or evidence-promotion changes.

## Done Condition

- Unfiltered handoff lists still query with a bounded `take`.
- Status-filtered handoff lists derive statuses from all base-filtered accepted candidates, filter by status, then apply the bounded display limit.
- Regression tests cover a matching status row that appears after the requested display limit in the unfiltered ordering.
- README/project memory document that status filtering happens before the row limit.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `README.md`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Status-filtered calls may read more accepted candidates than unfiltered calls because the status is derived from related curation tables.
- The displayed result count must remain bounded after filtering.
