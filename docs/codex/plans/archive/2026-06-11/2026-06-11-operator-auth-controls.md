# Operator Auth Controls

## Goal

Advance the authenticated operator surface by giving configured deployments an explicit GitHub sign-in path and signed-in operators an explicit sign-out path, without exposing source-candidate write controls.

## Scope

- Add server-action backed sign-in/sign-out forms to `/operator`.
- Keep the auth-unavailable state fail-closed when database-backed GitHub OAuth is not configured.
- Keep candidate review UI read-only; do not add accept/reject, claim-link, extraction, or promotion browser controls.
- Add a focused source-level test for the auth controls and read-only boundary.

## Validation

- `npm run test -- src/app/operator/operator-auth-controls.test.ts src/app/api/auth-route-boundary.test.ts src/app/api/live-source-readonly-boundary.test.ts src/lib/operator/session.test.ts`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
