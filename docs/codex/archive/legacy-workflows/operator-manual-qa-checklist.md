# Operator Manual QA Checklist

Last updated: 2026-06-11

Use this checklist in a non-production environment before exposing browser write controls for source-candidate review, claim linking, study extraction, or promotion.

## Preconditions

- Managed or local non-production PostgreSQL is reachable.
- GitHub OAuth/Auth.js variables are configured: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`; for dashboard-managed Vercel environments, reviewed `APEX_VERCEL_DATABASE_CONFIGURED_AT` and `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT` evidence can stand in for copying secret values into the local shell.
- At least one active operator has been bootstrapped or verified.
- Public routes remain read-only.
- `npm run operator:readiness` has been run and remaining blockers are understood.
- `npm run operator:smoke -- <base-url>` has passed for the anonymous `/operator` boundary.

## Access Checks

- Anonymous `/operator` shows a closed access state and no review queue, promotion panel, or sign-out content.
- For auth-unavailable environments, run `npm run operator:smoke -- <base-url> --expect-auth-unavailable`.
- For configured-auth environments before sign-in, run `npm run operator:smoke -- <base-url> --expect-auth-required`.
- Auth-unavailable deployments show `Operator auth unavailable`.
- Authorized active operators can sign in with GitHub and sign out.
- Disabled operators cannot access active review surfaces.
- Reviewer, admin, and owner roles only see surfaces appropriate to their role.

## Read-Only Surface Checks

- Candidate review queue renders for active reviewer+ operators.
- Promotion readiness renders only for admin+ operators.
- The browser surface still shows `Read-only` before write controls are approved.
- No public route imports source-candidate persistence or exposes operator writes.

## Controlled Write QA

Perform these only in non-production with throwaway or reviewed source-candidate data.

- Start with `APEX_OPERATOR_WRITES_ENABLED=false` and verify all operator writes fail closed.
- For Vercel Preview browser QA, temporarily set `APEX_OPERATOR_QA_FIXTURE_ENABLED=true` and redeploy to load one synthetic `operator-qa-*` source candidate; remove it and redeploy after QA to clean the fixture.
- Verify browser accept/reject, claim-link, and extraction controls stay hidden until write QA evidence, manual flow QA evidence, browser-control approval evidence, and `APEX_OPERATOR_WRITES_ENABLED=true` are all present.
- Temporarily set `APEX_OPERATOR_WRITES_ENABLED=true` only for the QA session.
- Verify candidate accept/reject requires an active operator with the right role and appends an audit event.
- Verify claim-link writes require admin+ permission and append an audit event.
- Verify structured study extraction requires admin+ permission and appends an audit event.
- Verify promotion remains blocked until claim link, structured extraction, citation traceability, human review, and `publicSourcePacketReady=true` are all present.
- Verify public promotion controls render only for a ready accepted candidate row, require an admin+ operator note, mark only the target claim as human-reviewed, and append an audit event.
- Reset `APEX_OPERATOR_WRITES_ENABLED=false` after QA.

## Evidence To Record

Record evidence outside the repo, then set these local evidence variables only in the relevant non-production/operator environment:

- `APEX_OPERATOR_ACTIVE_ACCOUNT_READY=true`
- `APEX_VERCEL_DATABASE_CONFIGURED_AT=<ISO timestamp>` after confirming the managed database variable in the Vercel dashboard
- `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT=<ISO timestamp>` after confirming Auth.js and GitHub OAuth variables in the Vercel dashboard
- `APEX_OPERATOR_NONPROD_WRITE_QA_AT=<ISO timestamp>`
- `APEX_OPERATOR_FLOW_QA_REVIEWED_AT=<ISO timestamp>`
- `APEX_OPERATOR_BROWSER_WRITE_CONTROLS_APPROVED_AT=<ISO timestamp>`

After recording evidence, rerun:

```bash
npm run operator:readiness
```

The readiness report includes `worksheet.copySafeCommands` for refreshing readiness, checking anonymous `/operator` boundaries, dry-running an operator bootstrap plan, and refreshing launch readiness. Treat those as copy-safe starting points; any write still requires the separate documented `--apply`, matching confirmation email, and non-production write gate.

Do not copy OAuth secrets, session secrets, database passwords, source-candidate private notes, or operator tokens into docs, commits, screenshots, or public routes.
