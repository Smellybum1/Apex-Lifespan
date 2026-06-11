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
- Product/deployment confirmation is still needed for seed-backed public demo mode versus managed production PostgreSQL.
- Latest source-candidate snapshot has 49 pending candidates and 1 accepted candidate that still needs claim-link curation.

## Ordered Steps

1. [x] Reconfirm the baseline and publishing constraint.
   Done when: worktree is clean, branch ahead/behind state is known, and the current no-push constraint is still captured in handoff.
   Validate with: `git status -sb`, `git log -3 --oneline`.
   Completed 2026-06-11: `git status -sb` reported `codex/queue-claim-sources...origin/codex/queue-claim-sources [ahead 3]` with a clean worktree; `git log -3 --oneline` reported `9e7c02a Add public MVP roadmap`, `22d17b7 Trim workflow guardrails`, and `6889e65 Record local-only handoff state`; `docs/codex/handoff.md` still records the GitHub no-push constraint.

2. [x] Restore local data operations.
   Done when: Docker Desktop is running, PostgreSQL is healthy, migrations apply cleanly, seed data verifies, and source-candidate DB preflight is reachable.
   Validate with: `docker compose ps`, `npm run db:migrate`, `npm run db:seed`, `npm run ingest:sources -- --db-status`.
   Completed 2026-06-11: launched Docker Desktop, `docker compose ps` reported `apexlifespan-postgres-1` healthy on `localhost:5432`; `npm run db:migrate` reported the schema already in sync; `npm run db:seed` reported `Seed integrity verified`; `npm run ingest:sources -- --db-status` reported `reachable=true`.

3. [ ] Freeze the public MVP data mode.
   Done when: the team has chosen `APEX_DATA_SOURCE=seed` for the first public demo or has explicitly chosen a managed production PostgreSQL database.
   Recommended decision: use `APEX_DATA_SOURCE=seed` for the public demo, keep source-candidate review local, and graduate to database-backed public data after curation readiness improves.
   Validate with: README or handoff note naming the selected mode.
   Blocked 2026-06-11: needs product/deployment confirmation to use the recommended seed-backed public demo mode or choose a managed production PostgreSQL database.

4. [x] Audit demo content quality.
   Done when: first-screen claims, source packets, review-status labels, AU/TGA copy, and label-risk empty states are credible enough for a public demo and do not expose placeholder-looking copy in key paths.
   Validate with: targeted dashboard tests plus manual browser review.
   Completed 2026-06-11: seed-mode browser review covered desktop and mobile screenshots (`output/playwright/public-mvp-step4-desktop.png`, `output/playwright/public-mvp-step4-mobile.png`); the dashboard showed first-screen claims, source-packet status, review-status labels, AU/TGA product-level caveats, and cautious live-preview idle copy. Replaced public product-card brand copy from internal `Seed example` to `Demo profile`. `npm run db:seed` and `npm run test -- src/components/evidence-dashboard.test.tsx src/lib/source-packet.test.ts src/lib/seed-integrity.test.ts` passed.

5. [ ] Resolve the accepted PMID 42141930 curation decision.
   Done when: either the accepted candidate is claim-linked and structurally extracted in local DB, or the public MVP explicitly defers source-candidate curation from the public demo scope.
   Validate with: `npm run ingest:sources -- --candidate-curation-handoff` when DB is available, or a short handoff note if deferred.
   Blocked 2026-06-11: `npm run ingest:sources -- --candidate-curation-handoff` still reports `status="Claim link missing"`, `publicSourcePacketReady=false`, `nextWrite="claimLink"`, and `writeReady=true` for `PMID 42141930`. Claim-link and extraction writes are human-owned local curation actions, so this needs either human review to perform the claim-link/extraction or explicit confirmation to defer source-candidate curation from the public MVP.

6. [x] Confirm public route boundaries.
   Done when: public API routes remain GET-only/read-only, source-candidate persistence stays out of public app/runtime surfaces, and live preview wording still frames results as unreviewed leads.
   Validate with: `npm run test -- src/app/api/live-source-readonly-boundary.test.ts src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts`.
   Completed 2026-06-11: boundary tests passed with 27 assertions across three files, covering GET-only/read-only route handlers, no source-candidate persistence imports or write surfaces in public runtime files, live preview request normalization, no-store/noindex response headers, public-safe upstream error text, and review-priority score labels.

7. [ ] Choose the deployment path.
   Done when: hosting target, environment variables, build command, start command, and rollback path are documented.
   Required decision: if GitHub push remains blocked, choose a local-artifact/manual deploy path or wait for push access.
   Validate with: README or handoff note naming host, deployment mode, and rollback.
   Blocked 2026-06-11: GitHub push limit remains active and no alternate public host/manual artifact deployment path has been selected. Needs a deployment decision before production environment configuration, release validation, browser QA, or deploy steps can be completed as release-ready work.

8. [ ] Prepare production environment configuration.
   Done when: `.env.example` covers the public demo knobs, secrets are not committed, sidecar tokens remain local-only, and public deploy mode has a clear `APEX_DATA_SOURCE` value.
   Validate with: env diff review and `git diff --check`.
   Partially prepared 2026-06-11: `.env.example` documents local `auto`, recommended public MVP/demo `seed`, and managed-production `database` values for `APEX_DATA_SOURCE`; sidecar variables remain commented and explicitly local-only. Blocked for completion until steps 3 and 7 select the public data mode and deployment path.

9. [x] Run full local release validation.
   Done when: core checks pass from a clean worktree after stopping the dev server.
   Validate with: `npm run test`, `npm run lint`, `npm run dev:stop`, `npm run typecheck`, `npm run build`, `npm audit`.
   Completed 2026-06-11 for the current local production build: clean worktree, no dev server running, `npm run test` passed 21 files/336 tests, `npm run lint` passed, `npm run dev:stop` found no listener, `npm run typecheck` passed, `npm run build` passed, and `npm audit` found 0 vulnerabilities. Rerun if deployment config or code changes before public deploy.

10. [x] Run browser QA on the production build.
    Done when: desktop and mobile views render without obvious layout overlap, live preview controls are usable, empty/error states are cautious, and first-viewport content communicates the product clearly.
    Validate with: local production build smoke and screenshots.
    Completed 2026-06-11 in seed-mode production server smoke: desktop and mobile screenshots saved at `output/playwright/public-mvp-step10-prod-desktop.png` and `output/playwright/public-mvp-step10-prod-mobile.png`; PubMed and ClinicalTrials.gov preview controls both returned live results with review-priority/research-lead caveats, captured at `output/playwright/public-mvp-step10-prod-pubmed-preview.png` and `output/playwright/public-mvp-step10-prod-trials-preview.png`. Stopped the production server afterward with `npm run dev:stop`.

11. [ ] Deploy the public MVP/demo.
    Done when: a public HTTPS URL renders the dashboard and both live preview routes respond with safe public behavior.
    Validate with: public URL smoke test, `/api/pubmed/search?term=creatine`, `/api/trials/search?term=creatine`, invalid-term checks, and response header checks for live routes.
    Blocked 2026-06-11: no public deployment path is selected while GitHub push limit remains active, so there is no public HTTPS URL to smoke test yet.

12. [ ] Publish launch handoff.
    Done when: README or handoff includes the public URL, selected data mode, known limitations, rollback path, and remaining fully-live gaps.
    Validate with: docs diff review and `git diff --check`.
    Blocked 2026-06-11: depends on step 11 producing a public URL and step 7 naming the selected deployment mode and rollback path.

13. [ ] Rollover this roadmap.
    Done when: every step above is complete, this file is archived, and a new `docs/codex/roadmap.md` is created for the fully live end product.
    Archive path: `docs/codex/archive/roadmap/YYYY-MM-DD-public-live-mvp.md`.
    Required successor title: `# Roadmap: Fully Live End Product`.
    Blocked 2026-06-11: public MVP roadmap cannot roll over until the blocked product/deployment/curation decisions are resolved and steps 3, 5, 7, 8, 11, and 12 are complete or explicitly deferred.

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
