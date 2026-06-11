# Evidence Coverage Review Backlog

## Goal

Advance evidence coverage work by turning the read-only coverage report into a concrete human review backlog without changing claim review status or public evidence.

## Scope

- Add ranked claim review backlog rows to `npm run coverage:review`.
- Include packet status, source counts, next action, and priority reasons.
- Add intervention gap detail for interventions without any local claim coverage.
- Keep output read-only and avoid marking any draft as human-reviewed.

## Validation

- `npm run test -- src/lib/evidence-coverage.test.ts src/lib/source-packet.test.ts src/lib/seed-integrity.test.ts`
- `npm run coverage:review`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`
- `git diff --check`
