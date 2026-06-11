# Launch Readiness Report

## Goal

Add a read-only launch readiness command that summarizes existing fully-live blockers without enabling writes, relaxing human review, or duplicating secrets in output.

## Scope

- Aggregate production, operator, operations, scheduled ingestion, promotion, coverage, and public smoke evidence into one local report.
- Keep source-candidate promotion, review status changes, and scheduled ingestion writes human-owned and explicitly gated.
- Report blocker IDs and next actions, not secret values.

## Validation

- Unit tests for ready and blocked aggregation.
- Local command smoke for the current blocked checkout.
- Targeted readiness/scheduler/promotion/coverage tests plus typecheck, build, lint, audit, and `git diff --check`.
