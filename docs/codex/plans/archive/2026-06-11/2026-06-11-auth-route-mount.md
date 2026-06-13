# Auth Route Mount Slice

Date: 2026-06-11

## Goal

Mount the Auth.js route handlers required for GitHub OAuth/operator sessions while preserving public evidence/source-candidate boundaries.

## Scope

- Add `/api/auth/[...nextauth]/route.ts` that exports Auth.js `GET` and `POST` handlers from `src/auth.ts`.
- Keep the route limited to authentication plumbing.
- Add a dedicated boundary test for the auth route.
- Narrow the live-source public-route boundary test so the auth route is not treated as a live-source preview route.

## Non-Goals

- Source-candidate writes.
- Operator browser write controls.
- OAuth secret configuration or manual sign-in QA.

## Validation

- Auth route boundary tests.
- Public live-source boundary tests.
- Operator/session tests.
- `npm run typecheck`.
- `npm run build`.
- `npm run lint`.
- `npm audit`.

