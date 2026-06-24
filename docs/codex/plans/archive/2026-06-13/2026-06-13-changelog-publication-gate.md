# Changelog Publication Gate

## Goal

Add the smallest operator-owned workflow for publishing draft database changelog entries created by human review flows.

## Scope

- Server-side helper only; no public route writes.
- Require authenticated active admin evidence-promotion permission, global operator writes, and a dedicated changelog publication approval timestamp.
- Require an explicit human publication note.
- Audit successful publication with before/after summaries.

## Validation

- Focused operator publication tests.
- Relevant type/lint/diff checks after the slice.

## Result

Implemented in the Sprint 2 operator publication flow and archived during the 2026-06-15 context-efficiency cleanup. Current state belongs in `docs/codex/handoff.md`; detailed behavior belongs in task-specific reference docs or tests.
