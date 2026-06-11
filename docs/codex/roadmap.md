# Roadmap: Public Live MVP/Demo

Last updated: 2026-06-11

## Target

Ship a public, read-only Apex Lifespan demo URL that renders the evidence dashboard, keeps AU/TGA and citation caveats visible, supports user-triggered live PubMed and ClinicalTrials.gov previews, and exposes no public review/admin writes.

Recommended MVP path: ship seed-backed first with live preview routes enabled. This avoids blocking the public demo on production curation data while preserving the existing local PostgreSQL workflow for source review.

## Non-Goals

- Public admin/review UI.
- Automated source-candidate promotion into public evidence.
- Scheduled ingestion jobs.
- Full product-level ARTG/AUST verification across the catalog.
- Medical advice, dosing, sourcing, reconstitution, injection, cycling, or self-administration guidance.

## Current Blockers

- GitHub push limit is active; no GitHub pushes until the user lifts it or an alternate deployment path is selected.
- Docker/PostgreSQL is not running locally, so source-candidate review and curation cannot continue today.
- Last successful source-candidate snapshot had 49 pending candidates and 1 accepted candidate that still needs claim-link curation.

## Ordered Steps

1. [ ] Reconfirm the baseline and publishing constraint.
   Done when: worktree is clean, branch ahead/behind state is known, and the current no-push constraint is still captured in handoff.
   Validate with: `git status -sb`, `git log -3 --oneline`.

2. [ ] Restore local data operations.
   Done when: Docker Desktop is running, PostgreSQL is healthy, migrations apply cleanly, seed data verifies, and source-candidate DB preflight is reachable.
   Validate with: `docker compose ps`, `npm run db:migrate`, `npm run db:seed`, `npm run ingest:sources -- --db-status`.

3. [ ] Freeze the public MVP data mode.
   Done when: the team has chosen `APEX_DATA_SOURCE=seed` for the first public demo or has explicitly chosen a managed production PostgreSQL database.
   Recommended decision: use `APEX_DATA_SOURCE=seed` for the public demo, keep source-candidate review local, and graduate to database-backed public data after curation readiness improves.
   Validate with: README or handoff note naming the selected mode.

4. [ ] Audit demo content quality.
   Done when: first-screen claims, source packets, review-status labels, AU/TGA copy, and label-risk empty states are credible enough for a public demo and do not expose placeholder-looking copy in key paths.
   Validate with: targeted dashboard tests plus manual browser review.

5. [ ] Resolve the accepted PMID 42141930 curation decision.
   Done when: either the accepted candidate is claim-linked and structurally extracted in local DB, or the public MVP explicitly defers source-candidate curation from the public demo scope.
   Validate with: `npm run ingest:sources -- --candidate-curation-handoff` when DB is available, or a short handoff note if deferred.

6. [ ] Confirm public route boundaries.
   Done when: public API routes remain GET-only/read-only, source-candidate persistence stays out of public app/runtime surfaces, and live preview wording still frames results as unreviewed leads.
   Validate with: `npm run test -- src/app/api/live-source-readonly-boundary.test.ts src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts`.

7. [ ] Choose the deployment path.
   Done when: hosting target, environment variables, build command, start command, and rollback path are documented.
   Required decision: if GitHub push remains blocked, choose a local-artifact/manual deploy path or wait for push access.
   Validate with: README or handoff note naming host, deployment mode, and rollback.

8. [ ] Prepare production environment configuration.
   Done when: `.env.example` covers the public demo knobs, secrets are not committed, sidecar tokens remain local-only, and public deploy mode has a clear `APEX_DATA_SOURCE` value.
   Validate with: env diff review and `git diff --check`.

9. [ ] Run full local release validation.
   Done when: core checks pass from a clean worktree after stopping the dev server.
   Validate with: `npm run test`, `npm run lint`, `npm run dev:stop`, `npm run typecheck`, `npm run build`, `npm audit`.

10. [ ] Run browser QA on the production build.
    Done when: desktop and mobile views render without obvious layout overlap, live preview controls are usable, empty/error states are cautious, and first-viewport content communicates the product clearly.
    Validate with: local production build smoke and screenshots.

11. [ ] Deploy the public MVP/demo.
    Done when: a public HTTPS URL renders the dashboard and both live preview routes respond with safe public behavior.
    Validate with: public URL smoke test, `/api/pubmed/search?term=creatine`, `/api/trials/search?term=creatine`, invalid-term checks, and response header checks for live routes.

12. [ ] Publish launch handoff.
    Done when: README or handoff includes the public URL, selected data mode, known limitations, rollback path, and remaining fully-live gaps.
    Validate with: docs diff review and `git diff --check`.

13. [ ] Rollover this roadmap.
    Done when: every step above is complete, this file is archived, and a new `docs/codex/roadmap.md` is created for the fully live end product.
    Archive path: `docs/codex/archive/roadmap/YYYY-MM-DD-public-live-mvp.md`.
    Required successor title: `# Roadmap: Fully Live End Product`.

## Automatic Rollover Rule

When step 13 is reached, do this in the same local change:

1. Move this public-MVP roadmap to `docs/codex/archive/roadmap/YYYY-MM-DD-public-live-mvp.md`.
2. Create a fresh `docs/codex/roadmap.md` for the fully live end product.
3. Seed the successor roadmap with ordered steps covering production database, authenticated review/admin workflow, scheduled ingestion, curation promotion, broader evidence coverage, regulatory/product verification, monitoring, backups, privacy/terms, and launch operations.
4. Update `docs/codex/handoff.md` with the archive path and the new roadmap target.
5. Commit locally. Do not push while the GitHub push limit remains active.

## Successor Roadmap Seed

Use this outline for the replacement roadmap after the public MVP/demo ships:

1. Production data platform and migrations.
2. Authenticated operator/admin review workflow.
3. Scheduled source ingestion with rate limits and failure handling.
4. Human-reviewed curation promotion from candidate to public evidence packet.
5. Expanded evidence and intervention coverage.
6. Product-level AU/TGA verification workflow.
7. Observability, backups, privacy/terms, and operational runbooks.
8. Performance, accessibility, and public analytics.
9. Fully live launch checklist and post-launch monitoring.
