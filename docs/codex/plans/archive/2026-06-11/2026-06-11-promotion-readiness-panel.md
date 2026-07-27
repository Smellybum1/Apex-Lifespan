# Promotion Readiness Panel

## Goal

Advance human-reviewed curation promotion by showing authenticated operators a read-only list of accepted candidates and their promotion blockers.

## Scope

- Add a bounded promotion-readiness snapshot helper built from existing curation handoff status.
- Render a protected `/operator` panel for admin+ operators only.
- Keep the panel read-only: no promote, accept/reject, claim-link, or extraction controls.
- Keep public routes and dashboard surfaces read-only.

## Validation

- `npm run test -- src/lib/operator/curation-promotion.test.ts src/app/operator/operator-auth-controls.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- Broader operator/public-boundary bundle.
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
