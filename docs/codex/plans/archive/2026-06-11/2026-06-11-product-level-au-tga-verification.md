# Product-Level AU/TGA Verification Slice

Date: 2026-06-11

## Goal

Make product-level Australian regulatory verification explicit without changing public write boundaries. The dashboard and local review report must keep product ARTG/AUST status separate from ingredient/intervention evidence.

## Scope

- Add a read-only verification helper that classifies each product as `Verified`, `Unknown`, `Stale`, or `Missing`.
- Attach an AU confidence label to product-level verification records.
- Keep intervention-level AU/TGA records from satisfying product-level verification.
- Show the product-level state and confidence in the existing label analyzer cards.
- Add a local report command for operator review.

## Validation

- `npm run test -- src/lib/australia-regulatory-verification.test.ts src/components/evidence-dashboard.test.tsx src/lib/regulatory.test.ts`
- `npm run regulatory:review`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`

