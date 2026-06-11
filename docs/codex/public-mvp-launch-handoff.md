# Public MVP Launch Handoff Draft

Status: draft until a public URL exists and final smoke passes.

## Public URL

- URL: pending authenticated manual Vercel deployment.
- Deployed from branch: `codex/queue-claim-sources`.
- GitHub push status: no push while push limit remains active.

## Selected Mode

- Data mode: `APEX_DATA_SOURCE=seed`.
- Deployment path: manual Vercel CLI deployment from the local checkout.
- Public database: none for MVP. Do not configure `DATABASE_URL` unless the release is deliberately switched to managed PostgreSQL.
- Local-only controls: do not configure `APEX_CODEX_THREAD_ID`, `APEX_CODEX_REVIEW_TOKEN`, or other Codex sidecar variables in public deployment.

## Predeploy Validation

Latest local validation already passed for the current build. Rerun after any code or environment change before deployment:

```bash
npm run test
npm run lint
npm run dev:stop
npm run typecheck
npm run build
npm audit
```

## Final Public Smoke

Run after the public URL exists:

```bash
npm run smoke:public-mvp -- <public-url>
```

Record result here before launch handoff is considered complete:

- Smoke result: pending.
- Smoke date/time: pending.
- Public URL checked: pending.

## Known Limitations

- Source-candidate review and promotion remain local operator workflows only.
- Accepted `PMID 42141930` remains local curation backlog until a human-owned claim-link and structured extraction are completed.
- Live PubMed and ClinicalTrials.gov results are unreviewed research leads; scores rank review priority, not evidence quality.
- Evidence cards remain unreviewed AI drafts unless explicitly marked otherwise.
- Product-level AU/TGA confidence still requires product-level ARTG/AUST verification.
- Public MVP provides general evidence intelligence only, not individualized medical advice.

## Rollback

- Roll back with `vercel rollback <deployment-url>` or the Vercel dashboard.
- After rollback, rerun `npm run smoke:public-mvp -- <public-url>`.
- If live-source routes fail but the dashboard renders, keep the demo public only if caveats remain visible and the failure mode is public-safe.

## Fully Live Gaps

- Production data platform and migrations.
- Authenticated operator/admin review workflow.
- Scheduled source ingestion with rate limits and failure handling.
- Human-reviewed curation promotion from candidate to public evidence packet.
- Expanded evidence and intervention coverage.
- Product-level AU/TGA verification workflow.
- Observability, backups, privacy/terms, and operational runbooks.
- Performance, accessibility, and public analytics.
- Fully live launch checklist and post-launch monitoring.
