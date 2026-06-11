# Operations Readiness Report Plan

Date: 2026-06-11

## Goal

Add a repeatable, read-only local report for roadmap step 11 so operations evidence can be checked before the fully-live launch without configuring external services from code.

## Scope

- Check that local privacy, terms, and operations runbook artifacts exist.
- Report missing external proof for uptime monitoring, error monitoring, deployment alerts, scheduled-ingestion alerts, database backups, restore rehearsal, rollback drill, and alert testing.
- Print only sanitized evidence and env variable names; do not print secret values.
- Keep public routes read-only and add no hosted write path.

## Validation

- Focused unit tests for ready, blocked, and missing-local-artifact reports.
- Run the CLI locally to confirm expected blocked external checks.
- Run targeted public-boundary/legal tests plus typecheck, build, lint, audit, and diff check.
