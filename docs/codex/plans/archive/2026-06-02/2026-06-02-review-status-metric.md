# Review Status Metric

## Goal

Make the dashboard's top review-status metric accurately report human-reviewed and draft-awaiting-review claim counts.

## Constraints

- Keep the public read-only MVP.
- Preserve the existing review-status labels.
- Avoid wider UI refactors.

## Done Condition

- The `Human-reviewed` metric uses shared summary logic rather than inline filtering.
- The draft detail count reflects only unreviewed draft claims.
- Focused tests cover mixed, all-draft, and empty claim lists.
- Project memory records that review-status counts have regression coverage.

## Files Likely Touched

- `src/lib/review-summary.ts`
- `src/lib/review-summary.test.ts`
- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Steps

1. Add a small review-summary helper and tests.
2. Wire the dashboard metric to the helper.
3. Update project memory.
4. Validate and smoke check the app.

## Validation

- `npm run test -- src/lib/review-summary.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Local HTTP smoke

## Risks

- The metric should not imply draft claims are human-reviewed.
- Empty data should render stable counts.

## Result

- Added `summarizeReviewStatus` with tests for mixed, partly reviewed, and empty claim sets.
- Updated the dashboard `Human-reviewed` metric to show reviewed count and actual unreviewed draft count.
- Browser snapshot confirmed the current seed UI shows `0` human-reviewed and `7 drafts awaiting review`.
- Validation passed: targeted review-summary tests, full test suite, lint, typecheck, build, and local HTTP smoke.
