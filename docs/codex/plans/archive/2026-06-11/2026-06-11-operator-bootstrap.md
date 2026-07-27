# Operator Bootstrap Slice

Date: 2026-06-11

## Goal

Advance authenticated operator/admin surfaces by adding an explicit local helper to seed the first operator account once database-backed GitHub OAuth is configured.

## Scope

- Add a local-only operator bootstrap command.
- Default to dry-run.
- Require `--apply`, matching `--confirm-email`, and `APEX_OPERATOR_WRITES_ENABLED=true` before writing.
- Upsert a `User` and `OperatorProfile`, and append an audit event when applied.

## Non-Goals

- Public operator writes.
- Source-candidate accept/reject, claim-linking, extraction, or promotion.
- Automatic operator creation during auth callbacks.

## Validation

- Operator bootstrap unit tests.
- Dry-run command.
- Operator authorization/session/public-boundary tests.
- `npm run typecheck`.
- `npm run build`.
- `npm run lint`.
- `npm audit`.

