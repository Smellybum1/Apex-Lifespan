# Roadmap: Fully Live End Product

Last updated: 2026-06-11

## Target

Ship Apex Lifespan as a fully live, public evidence intelligence product with managed production data, authenticated human review, scheduled source ingestion, explicit curation promotion, product-level AU/TGA verification workflows, monitoring, backups, privacy/terms, and launch operations.

The public seed-backed MVP/demo is already live at `https://apex-lifespan.vercel.app`. This roadmap starts from that baseline and works toward the production-grade version.

## Non-Goals

- Automated promotion of source candidates into public evidence without human review.
- Public unauthenticated review/admin writes.
- Medical advice, diagnosis, treatment instructions, peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.
- Product-level ARTG/AUST confidence inferred from generic intervention evidence.

## Current Baseline

- Public MVP/demo URL: `https://apex-lifespan.vercel.app`.
- Public data mode: `APEX_DATA_SOURCE=seed`.
- Public routes and dashboard are read-only.
- Live PubMed and ClinicalTrials.gov previews are user-triggered unreviewed research leads.
- Source-candidate ingestion/review/promotion remains local and human-owned.
- Completed public-MVP roadmap archive: `docs/codex/archive/roadmap/2026-06-11-public-live-mvp.md`.

## Ordered Steps

1. [x] Reconfirm the live baseline and repo state.
   Done when: public smoke still passes, the production branch/commit is known, and the local worktree is clean before new fully-live work starts.
   Validate with: `git status -sb`, `git log -3 --oneline`, `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app`.
   Completed 2026-06-11: `git status -sb` reported a clean `codex/queue-claim-sources...origin/codex/queue-claim-sources`; `git log -3 --oneline` reported `30d6830 Record public MVP launch`, `762f5cb Generate Prisma client during build`, and `9632d8f Record restored GitHub deploy path`; `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app` passed homepage caveats, PubMed live preview, ClinicalTrials.gov live preview, and invalid-term guards.

2. [x] Decide the production data architecture.
   Done when: the managed PostgreSQL provider, region, environment variable model, migration policy, backup expectations, and rollback expectations are documented.
   Validate with: docs diff review and an explicit decision note in this roadmap or handoff.
   Completed 2026-06-11: selected Neon Postgres through the Vercel Marketplace, initial region `aws-us-east-1`, Vercel Preview/Production-scoped `DATABASE_URL` plus `APEX_DATA_SOURCE=database`, Prisma `migrate deploy` rehearsal before production, Neon point-in-time restore plus exported backup rehearsal, and app/data rollback expectations. Decision note: `docs/codex/production-data-architecture.md`.

3. [ ] Provision production database and secrets.
   Done when: production/staging database URLs are configured in the hosting environment, secrets are not committed, Prisma can connect, and seed fallback is not accidentally masking production database failures.
   Validate with: `npm run db:validate`, `npm run db:migrate:deploy` against a non-production rehearsal database, and a production readiness checklist before any production migration.
   Blocked 2026-06-11: requires operator access to Vercel/Neon console and secret entry. Local evidence: `.vercel` is not linked, Vercel CLI is not available on PATH, and `npm run db:validate` passed against the committed Prisma schema. Continue once Neon production/staging targets and Vercel environment variables can be configured.

4. [ ] Migrate from seed-backed demo to database-backed public reads.
   Done when: public deployment intentionally uses `APEX_DATA_SOURCE=database`, the dashboard renders from managed data, and public failure modes stay safe if the database is unreachable.
   Validate with: `npm run test`, `npm run typecheck`, `npm run build`, public smoke, and a database-mode browser review.
   Blocked 2026-06-11: depends on step 3 provisioning managed database URLs and setting `APEX_DATA_SOURCE=database` in the relevant Vercel environment.

5. [x] Design authenticated operator/admin workflow.
   Done when: auth provider, roles, protected routes, audit fields, local-vs-public write boundaries, and emergency disable/rollback behavior are agreed before implementation.
   Validate with: architecture note or plan plus tests proving public routes remain read-only.
   Completed 2026-06-11: selected Auth.js with GitHub OAuth, Prisma-backed sessions, explicit operator roles, protected `/operator` or `/admin` surfaces, audited `/api/operator/*` writes, public route separation, `APEX_OPERATOR_WRITES_ENABLED` emergency disable, and Vercel/Neon rollback split. Design note: `docs/codex/operator-admin-auth-design.md`. Validation: `npm run test -- src/app/api/live-source-readonly-boundary.test.ts src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts`.

6. [ ] Build authenticated review/admin surfaces.
   Done when: source-candidate review, accept/reject, claim linking, extraction, and promotion controls are available only to authenticated operators and every write is explicit and auditable.
   Validate with: route authorization tests, write-boundary tests, and manual operator-flow QA.
   In progress 2026-06-11: added `docs/codex/plans/2026-06-11-authenticated-operator-surfaces.md`, Auth.js-compatible Prisma models, operator role/status models, and append-only operator audit schema foundation. Local migration `20260611131000_operator_auth_foundation` applied successfully with `npm run db:migrate`; `npm run db:validate`, `npm run db:generate`, public read-only boundary tests, and `npm run typecheck` passed.
   In progress 2026-06-11: added tested operator authorization policy helpers in `src/lib/operator/authorization.ts`; writes fail closed unless `APEX_OPERATOR_WRITES_ENABLED=true`, disabled operators are rejected, and role gates cover audit, candidate review, curation, promotion, and operator management. Validation: `npm run test -- src/lib/operator/authorization.test.ts src/app/api/live-source-readonly-boundary.test.ts src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts`; `npm run typecheck`.

7. [ ] Implement human-reviewed curation promotion.
   Done when: accepted candidates can become public evidence packets only after claim link, structured extraction, citation traceability, and human review are complete.
   Validate with: candidate-to-public promotion tests, source-packet tests, and a dry-run promotion of `PMID 42141930` before any public promotion.

8. [ ] Add scheduled source ingestion.
   Done when: PubMed and ClinicalTrials.gov ingestion jobs run on a schedule with rate limits, retries, dedupe, failure reporting, dry-run support, and no automatic public promotion.
   Validate with: scheduler dry run, integration tests with mocked upstreams, and source policy/rate-limit review.

9. [ ] Expand evidence and intervention coverage.
   Done when: priority interventions and claims have reviewed evidence packets, clear population/dose/form boundaries, and visible uncertainty labels.
   Validate with: seed/database integrity checks, source-packet tests, review sampling, and dashboard QA.

10. [ ] Add product-level AU/TGA verification workflow.
    Done when: product-level ARTG/AUST evidence can be tracked separately from ingredient-level evidence, with confidence labels and stale/unknown states.
    Validate with: regulatory data tests, UI review of unknown/stale states, and no inference from generic intervention evidence.

11. [ ] Add observability, backups, privacy, and operations.
    Done when: uptime/error monitoring, deployment alerts, database backups/restore rehearsal, privacy/terms copy, and operator runbooks are in place.
    Validate with: alert test, backup restore rehearsal, docs review, and deployment rollback drill.

12. [ ] Run full product QA and hardening.
    Done when: accessibility, mobile/desktop layout, performance, security headers, dependency audit, and regression suites pass for production data mode.
    Validate with: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, public smoke, browser QA, and accessibility/performance checks.

13. [ ] Launch the fully live product and monitor post-launch.
    Done when: production database mode is live, authenticated workflows are operational, scheduled ingestion is monitored, public smoke passes, rollback is rehearsed, and post-launch issues are tracked.
    Validate with: launch checklist, public URL smoke, admin-flow smoke, monitoring confirmation, and a 24-48 hour post-launch review.

## Automatic Rollover Rule

When step 13 is complete, do this in the same local change:

1. Move this roadmap to `docs/codex/archive/roadmap/YYYY-MM-DD-fully-live-end-product.md`.
2. Create a fresh `docs/codex/roadmap.md` for the next operating phase.
3. Seed the successor roadmap with ordered steps for coverage growth, quality operations, user feedback, analytics, and reliability improvements.
4. Update `docs/codex/handoff.md` with the archive path and new roadmap target.
5. Commit and push when useful.
