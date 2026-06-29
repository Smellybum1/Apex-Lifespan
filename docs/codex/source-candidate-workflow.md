# Source Candidate Workflow

Conditional local workflow. Do not load during ordinary startup; use this only when working on local ingestion, source candidates, accepted-candidate processing, benefit discovery, or claim/source linking.

## Current Path

Use the local dashboard first. The local tabs now handle the routine loop:

1. Start or resume local ingestion from the Local Ingestion tab.
2. Review pending candidates from Candidate Review; accept likely useful items and reject likely noise.
3. Run accepted-candidate processing before moving to maybe-useful candidates.
4. Use Benefit Discovery auto-build/preview for high-confidence local leads.
5. Use Identity Resolver when the dashboard flags a source as wrong or ambiguous for the selected supplement.

The dashboard is the preferred path because it keeps status, activity, accepted references, candidate processing, benefit clusters, identity blockers, and safe local-only actions visible in one place.

## Rules

- Public routes stay read-only; local ingestion routes must remain localhost-only.
- Candidates are review leads; triage and lead scores rank review priority, not evidence quality.
- Accepted candidates and auto-built claims do not become reviewed public evidence.
- Auto-built claims must stay unreviewed local drafts with conservative uncertainty and citation traceability.
- Use `Human reviewed` only after explicit human confirmation.
- Do not infer product-level ARTG/AUST status from generic intervention evidence.
- Avoid medical advice and peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## CLI Fallback

Use CLI commands only when the dashboard does not cover the task or when debugging local services:

```bash
npm run ingest:sources -- --help
npm run ingest:sources -- --db-status
npm run ingest:sources -- --summary
npm run ingest:sources -- --jobs --jobs-status queued
npm run ingest:sources -- --run-next --limit 1
```

For one-off catalog source queueing, inspect the script first and keep it local:

```bash
npx tsx scripts/queue-catalog-source-ingestion.ts --help
```

Do not use old promotion, readiness, launch, operator, onboarding, or review-packet aliases unless `package.json` currently exposes them or the user explicitly asks to restore that workflow.

## Public Promotion

Public promotion is out of the ordinary local workflow. If the user explicitly asks for preview/production promotion, inspect current scripts and docs first, ask before remote DB/deploy actions, and keep product-level AU/TGA and human-review boundaries intact.
