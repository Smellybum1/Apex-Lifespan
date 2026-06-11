# Operator/Admin Auth Design

Status: selected design for fully-live roadmap step 5. Implementation is deferred until the production database and secrets are provisioned.

## Decision

Use Auth.js with GitHub OAuth, Prisma-backed sessions, and an explicit operator role table.

Rationale:

- The app already uses Next.js App Router and Prisma/PostgreSQL.
- GitHub OAuth matches the current repository/operator workflow and avoids introducing password storage.
- Auth.js supports App Router route handlers, `AUTH_*` environment variables, and a Prisma adapter path.
- Operator authorization should be app-level, not Vercel Deployment Protection, because public users must still access the dashboard while admin/review writes stay protected.

## Roles

- `owner`: can manage operator roles, emergency-disable writes, and perform all review/admin actions.
- `admin`: can review candidates, link claims, edit structured extraction, and promote reviewed evidence.
- `reviewer`: can accept/reject candidates and draft claim links or extraction, but cannot publish public evidence without an admin/owner final action.
- `auditor`: read-only access to operator history and review packets.

No anonymous or public role can access operator routes or write endpoints.

## Protected Surfaces

- Public dashboard and public live-source routes stay unauthenticated and read-only.
- Operator UI lives under `/operator` or `/admin`; choose one path before implementation and keep it out of the first public viewport.
- Operator write APIs live under `/api/operator/*`.
- Source-candidate persistence must not be imported by public route handlers, public dashboard components, or unauthenticated runtime code.

## Authorization Rules

- All protected pages and route handlers call a shared server-only `requireOperatorRole(...)` helper.
- Authorization checks happen on the server for every write, not only in React components.
- Mutating route handlers reject unauthenticated requests with `401`, authenticated under-privileged requests with `403`, and emergency-disabled writes with `503`.
- Promotion into public evidence requires an explicit final action by `admin` or `owner`.
- Accepted candidates do not become public evidence until claim link, structured extraction, citation traceability, and human review are complete.

## Audit Fields

Every operator write records:

- actor user id and email
- role at the time of action
- action name
- target entity type and id
- before and after summaries
- source reference ids or candidate ids
- request id
- timestamp
- optional human note

Audit data is append-only. Corrections are new events, not edits to old events.

## Environment Variables

Production and Preview:

- `AUTH_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `DATABASE_URL`
- `APEX_DATA_SOURCE=database`
- `APEX_OPERATOR_WRITES_ENABLED=false` until the write workflow is ready for use

Use separate GitHub OAuth apps for preview/staging and production so callback URLs and test users do not mix with production operators.

## Emergency Disable And Rollback

- Set `APEX_OPERATOR_WRITES_ENABLED=false` to make operator mutating endpoints fail closed while keeping public dashboard reads available.
- Rotate `AUTH_SECRET` and GitHub OAuth secrets if session or OAuth credentials are suspected compromised.
- Revoke or downgrade operator roles instead of deleting audit-linked users.
- Use Vercel rollback for code rollback.
- Use Neon point-in-time restore or branch restore for data rollback; do not rely on Vercel rollback to restore database state.

## Implementation Sequence

1. Add Auth.js dependencies and Prisma auth/operator/audit models.
2. Add a server-only auth module and `requireOperatorRole(...)`.
3. Add protected operator shell with no mutating controls.
4. Add route authorization and public-boundary regression tests.
5. Add audited candidate review writes behind `APEX_OPERATOR_WRITES_ENABLED`.
6. Add promotion workflows only after candidate review writes are tested and auditable.

## References

- Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication
- Auth.js environment variables: https://authjs.dev/guides/environment-variables
- Auth.js deployment: https://authjs.dev/getting-started/deployment
- Auth.js Prisma adapter: https://authjs.dev/getting-started/adapters/prisma
