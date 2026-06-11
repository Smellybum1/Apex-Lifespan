# Authenticated Operator Surfaces Plan

Date: 2026-06-11

## Scope

Roadmap step 6: build authenticated source-candidate review/admin surfaces while preserving public read-only routes and human-reviewed promotion boundaries.

## Constraints

- Public dashboard and public API routes stay unauthenticated and read-only.
- Source-candidate writes remain explicit, audited, and human-owned.
- Promotion into public evidence is not automatic.
- No medical advice or peptide sourcing/dosing/administration guidance.
- Production database/secrets are not provisioned yet, so implementation must be locally testable and fail closed without secrets.

## Implementation Order

1. Add auth/operator/audit schema foundation:
   - Auth.js-compatible account/session/user/verification models.
   - Operator role and append-only audit models.
   - Emergency write-disable flag convention.
2. Add server-only authorization helpers:
   - session lookup boundary
   - role checks
   - write-disable check
   - audit helper shape
3. Add protected operator shell:
   - `/operator` route
   - no public navigation entry yet
   - unauthenticated users blocked
   - authenticated non-operators blocked
4. Add read-only review queue view:
   - uses existing source-candidate review helpers
   - no writes in the first UI slice
5. Add audited write routes and controls:
   - accept/reject candidate
   - claim link
   - study extraction
   - promotion remains separate and final

## Validation

- `npm run db:validate`
- `npm run db:generate`
- public read-only boundary tests
- targeted auth/operator tests as helpers/routes are added
- `npm run typecheck`

## Rollback

Auth/operator migrations should be additive only in the first slice. If the UI must be disabled, remove operator route exposure and set `APEX_OPERATOR_WRITES_ENABLED=false`; public dashboard remains unaffected.
