# Operations, Privacy, and Readiness Slice

Date: 2026-06-11

## Goal

Advance the fully-live operations roadmap step without needing hosting console access. This slice adds public privacy/terms surfaces and an operator runbook while leaving monitoring, backup restore rehearsal, and alert wiring as explicit external proof items.

## Scope

- Add public `/privacy` and `/terms` pages with clear evidence, medical-advice, live-source, local-storage, and AU/TGA boundaries.
- Link the pages from the public dashboard header.
- Add an operations runbook covering monitoring, deployment alerts, backups, rollback, and launch evidence.
- Record remaining external blockers in the roadmap and handoff.

## Validation

- Static render tests for the legal pages and dashboard links.
- Public read-only boundary tests.
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm audit`

