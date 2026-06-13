# Roadmap: Fully Live End Product

Last updated: 2026-06-13

## Target

Ship Apex Lifespan as a fully live public evidence intelligence product with managed production data, authenticated human review, scheduled source ingestion, explicit curation promotion, product-level AU/TGA workflows, monitoring, backups, privacy/terms, and launch operations.

The public MVP/demo is already live at `https://apex-lifespan.vercel.app`; it started seed-backed and is now database-backed for public reads. This roadmap tracks the remaining production-grade launch gates.

## Non-Goals

- Automated promotion of source candidates into public evidence without human review.
- Public unauthenticated review/admin writes.
- Medical advice, diagnosis, treatment instructions, peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.
- Product-level ARTG/AUST confidence inferred from generic intervention evidence.

## Current Baseline

- Public MVP/demo URL: `https://apex-lifespan.vercel.app`.
- Public data mode: `APEX_DATA_SOURCE=database`.
- Public routes and dashboard are read-only.
- Live PubMed and ClinicalTrials.gov previews are user-triggered unreviewed research leads.
- Source-candidate ingestion/review/promotion remains human-owned and explicit.
- Completed public-MVP roadmap archive: `docs/codex/archive/roadmap/2026-06-11-public-live-mvp.md`.

## Ordered Steps

1. [x] Reconfirm live baseline and repo state.
   Done when: public smoke passes, production branch/commit are known, and local worktree is clean.
   Latest state: seed-mode public smoke passed; branch work continued on `codex/queue-claim-sources`.
   Validate with: `git status -sb`, `git log -3 --oneline`, `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app`.

2. [x] Decide production data architecture.
   Done when: managed PostgreSQL provider, region, env model, migration policy, backups, and rollback expectations are documented.
   Latest state: Neon Postgres via Vercel Marketplace selected; details live in `docs/codex/production-data-architecture.md`.
   Validate with: docs diff review.

3. [x] Provision production database and secrets.
   Done when: Preview/staging and Production database/auth envs are configured, secrets remain uncommitted, Prisma can connect, and seed fallback cannot mask database failures.
   Latest state: Vercel Preview has dashboard-managed database/data-mode/operator-auth evidence. Production database mode is live for public reads, migrations are applied, seed/review data is present, and strict public database smoke passed. Production Vercel now has database evidence, data-mode evidence, migration-rehearsal evidence, production `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and `APEX_VERCEL_OPERATOR_AUTH_CONFIGURED_AT`. Production was redeployed as `https://apex-lifespan-jgcomlj13-tom-chanpheng-s-projects.vercel.app`, aliased to `https://apex-lifespan.vercel.app`, and strict public database smoke passed after redeploy. `/operator` now renders the GitHub sign-in gate instead of the auth-unavailable state. `npm run production:readiness -- --env-file .env.vercel.production.local --summary` is now `10 ready / 0 blocked / 2 warnings`; `npm run operator:readiness -- --env-file .env.vercel.production.local --summary` now has operator auth config ready and reports `13 ready / 4 blocked / 0 warnings`, with the remaining blockers belonging to production operator/account QA evidence.
   Validate with: `npm run production:readiness -- --summary`, `npm run production:readiness -- --env-file <non-production-env-file> --summary`, `npm run operator:readiness -- --env-file <non-production-env-file> --summary`, `npm run launch:readiness -- --env-file <non-production-env-file> --summary`, `npm run db:validate`, `npm run production:migration-rehearsal -- --env-file <non-production-env-file>`.

4. [x] Migrate from seed-backed demo to database-backed public reads.
   Done when: public deployment intentionally uses `APEX_DATA_SOURCE=database`, dashboard renders from managed data, and public database failure states stay sanitized/read-only.
   Latest state: strict database mode fails closed instead of falling back to seed data; public unavailable state is sanitized. Production is intentionally database-backed and `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app --require-database` passed on 2026-06-12. `APEX_PUBLIC_DATABASE_SMOKE_PASSED_AT=2026-06-12T10:01:21Z` is recorded locally in the ignored evidence env file.
   Validate with: `npm run test`, `npm run typecheck`, `npm run build`, `npm run smoke:public-mvp -- <fully-live-url> --require-database`, browser QA.

5. [x] Design authenticated operator/admin workflow.
   Done when: auth provider, roles, protected routes, audit fields, write boundaries, emergency disable, and rollback behavior are documented.
   Latest state: Auth.js + GitHub OAuth, Prisma sessions, operator roles/status, audited writes, and `APEX_OPERATOR_WRITES_ENABLED` design documented in `docs/codex/operator-admin-auth-design.md`.
   Validate with: public read-only boundary tests.

6. [x] Build authenticated review/admin surfaces.
   Done when: source-candidate review, accept/reject, claim linking, extraction, and promotion controls are authenticated, explicit, audited, and write-gated.
   Latest state: Preview GitHub/Auth.js operator sign-in works for OWNER. Production GitHub/Auth.js env vars are configured, `moxhelix@hotmail.com` is verified as an active OWNER operator in the managed database via audited bootstrap event `cmqblk1im00039ja8wdjf9bxi`, and Production evidence now records active-operator, non-production write QA, manual operator-flow QA, and browser-write-control approval. Production was redeployed as `https://apex-lifespan-d1go0sdnl-tom-chanpheng-s-projects.vercel.app`, aliased to `https://apex-lifespan.vercel.app`; strict public database smoke and anonymous auth-required operator smoke passed. `npm run operator:readiness -- --env-file .env.vercel.production.local --summary` reports `17 ready / 0 blocked / 0 warnings`. Browser write controls remain gated by `APEX_OPERATOR_WRITES_ENABLED`, which is still disabled by default. Real human-owned candidate review/promotion remains separate from synthetic QA.
   Validate with: `npm run operator:readiness -- --summary`, `npm run operator:readiness -- --env-file <non-production-env-file> --summary`, operator/page/browser-control tests, public-boundary tests, manual operator-flow QA.

7. [x] Implement human-reviewed curation promotion.
   Done when: accepted candidates can become public evidence only after matching curated reference, claim link, structured extraction, human review, and promotion audit.
   Latest state: audited promotion wrapper and gated browser promotion exist. `npm run ingest:sources` and promotion readiness helpers accept `--env-file <non-production-env-file>` for approved ignored env files. On 2026-06-12, the user human-reviewed PubMed `28615996` for `creatine-strength`; it was accepted against curated reference `issn-creatine-2017`, promoted through the audited OWNER operator action, and audit event `cmqap2n3500019ji4fohmvagc` was recorded. Current Preview DB curation status for the same candidate is `Public source packet ready` with decision `Accepted`, review status `Human reviewed`, accepted reference `issn-creatine-2017`, claim link present, structured extraction `study-creatine-issn`, and `publicSourcePacketReady=true`. `npm run promotion:readiness -- --env-file .env.vercel.preview.local --summary` reports `0 blocked / 1 ready`, targeted promotion/browser-control tests pass, and aggregate launch readiness now marks `promotion-readiness` ready. Pending source candidates remain human-review backlog and are not auto-promoted.
   Validate with: `npm run promotion:readiness -- --env-file .env.vercel.preview.local --summary`, `npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-review-overview --candidate-review-overview-limit 10`, operator tests.

8. [x] Add scheduled source ingestion.
   Done when: scheduled ingestion runs against managed database with explicit write gate, source caps, monitoring, retry policy, and no automatic promotion.
   Latest state: dry-run and hosted-readiness reports exist, and the scheduled-ingestion CLI now accepts `--env-file <operations-env-file>` for approved ignored evidence files. Non-production scheduler evidence was recorded locally after reviewing `docs/codex/scheduled-ingestion-retry-policy.md`, confirming zero failed jobs and zero duplicate source identities, configuring NCBI metadata, keeping alerts ready, and recording `APEX_INGESTION_RETRY_POLICY_APPROVED_AT=2026-06-12T07:05:06Z`. The guarded hosted-readiness rehearsal ran against Preview Neon with `npm run ingest:scheduled-run -- --env-file .env.vercel.preview.local --require-hosted-run-readiness`; it processed queued PubMed job `cmq9nhdcy000iey85ehxzdqz7`, found 3 records, changed 3 source-candidate rows, and kept `automaticRetries=false` and `noAutoPromotion=true`. Post-run dry-run reported `0` queued jobs, `0` failed jobs, hosted cron ready, retry policy ready, and no blocked checks. No hosted HTTP write route is exposed, and the new candidates remain pending human review with no public evidence promotion.
   Validate with: `npm run ingest:scheduled-dry-run -- --env-file .env.vercel.preview.local --summary`; guarded apply uses `npm run ingest:scheduled-run -- --env-file .env.vercel.preview.local --require-hosted-run-readiness`.

9. [x] Expand evidence and intervention coverage.
   Done when: coverage gaps are reduced, source packets and claim reviews are human-reviewed, and product-level AU/TGA evidence is explicit.
   Latest state: coverage summary reports 8 complete source packets, 0 intervention gaps, 8 human-reviewed claims, and 0 unreviewed claims. `creatine-strength` is human-reviewed in Preview via promoted PubMed `28615996` / `issn-creatine-2017`; all remaining complete claim packets were marked human-reviewed through audited OWNER claim-packet events. Product-level AU/TGA helper/report exists.
   Validate with: `npm run coverage:review -- --summary`, `npm run coverage:review -- --env-file .env.vercel.preview.local --summary`, `npm run regulatory:review`.

10. [x] Add product-level AU/TGA verification workflow.
    Done when: product-level regulatory states are visible and not inferred from intervention-level evidence.
    Latest state: read-only helpers, dashboard product chips, and `npm run regulatory:review` are implemented.
    Validate with: AU/TGA verification/dashboard/regulatory tests and public-boundary tests.

11. [x] Add observability, backups, privacy, and operations.
    Done when: health endpoint, privacy/terms, runbooks, monitoring, alerts, backups, restore rehearsal, rollback drill, and alert test evidence are ready.
    Latest state: `/api/health`, privacy/terms, runbooks, and operations checklists exist. Operations readiness accepts `--env-file <operations-env-file>` for approved ignored evidence files. A GitHub Actions scheduled uptime monitor for `https://apex-lifespan.vercel.app/api/health` was added to `main` at `bba47f2`; a public API error monitor was added to `main` at `6a36f39`; a Vercel commit-status deployment monitor was added to `main` at `ab4a616`; and a scheduled-ingestion dry-run monitor was added to `main` at `7f978a9`. GitHub Actions repository execution was enabled after verification showed the workflows existed but could not run while Actions was disabled. Matching evidence keys were recorded in the ignored local evidence file. Vercel CLI read-only checks confirmed the linked project, Neon integration resource, default alert rule, no webhooks, and no cron jobs; backup/PITR coverage is recorded after confirming the connected Neon resource and 6-hour project history retention. Backup restore rehearsal restored Preview Neon data into temporary database `apex_restore_rehearsal_20260612062621`, validated migrations/table counts/dashboard database mode, and dropped the target. Rollback drill identified current/previous Ready production deployments, confirmed the Vercel rollback command/status, confirmed the separate Neon data rollback path, and passed public smoke without rolling traffic. A manual-only `Launch Alert Test` workflow was added to `main` at `8a9f642`; the post-enable run `https://github.com/Smellybum1/Apex-Lifespan/actions/runs/27399894930` completed with the expected intentional failure at `2026-06-12T06:54:22Z`, and `APEX_ALERT_TESTED_AT` was recorded locally. Operations readiness with the env file now reports `13 ready / 0 blocked`.
    Validate with: `npm run operations:readiness -- --summary`, `npm run operations:readiness -- --env-file <operations-env-file> --summary`, public smoke, health checks, external monitoring/backup evidence.

12. [x] Run full product QA and hardening.
    Done when: accessibility, mobile/desktop layout, performance, security headers, dependency audit, and regression suites pass for production database mode.
    Latest state: full regression and hardening pass completed on 2026-06-13. `npm audit` initially found a high-severity transitive `esbuild@0.28.0` advisory; lockfile audit fix updated `esbuild` to `0.28.1`, and `npm audit` now reports 0 vulnerabilities. Dashboard mobile QA found body-level horizontal overflow and unassociated filter/search controls; `src/components/evidence-dashboard.tsx` now constrains grid/panel min-widths, keeps wide evidence map/table content inside scroll containers, and gives the search/filter controls explicit `id`/`htmlFor` labels. Local production server QA with `.env.vercel.preview.local` and `APEX_DATA_SOURCE=database` passed strict public smoke, desktop/mobile Playwright snapshots, console check, and a structured mobile probe: no horizontal overflow, 1 H1, 0 unnamed buttons/links, 0 unlabeled inputs, 0 missing image alt attributes, and fast local load timing. Screenshot artifacts: `output/playwright/step12-local-db-desktop.png` and `output/playwright/step12-local-db-mobile.png`. Live Production strict public database smoke and exact security-header assertion passed. Aggregate launch readiness remains `8 ready / 3 blocked / 1 warning`, with the remaining blockers belonging to final launch operations.
    Validate with: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, strict public smoke, browser QA, accessibility/performance checks.

13. [x] Launch fully live product and monitor post-launch.
    Done when: production database mode is live, authenticated workflows are operational, scheduled ingestion is monitored, public/admin smokes pass, rollback is rehearsed, and post-launch review is scheduled.
    Latest state: fully-live launch is approved and ready. Production auth hotfix `68981fe` allows the pre-bootstrapped operator user to link its first GitHub OAuth account, and Production redeployed as `https://apex-lifespan-jq6b5yqir-tom-chanpheng-s-projects.vercel.app`; strict public database smoke and anonymous operator smoke passed after redeploy. The user confirmed the authenticated Production operator console loaded, and `APEX_ADMIN_FLOW_SMOKE_PASSED_AT` was recorded locally in the ignored evidence env file. The 24-48 hour post-launch review is scheduled for Sunday, June 14, 2026 at 2:00 PM Australia/Brisbane, and explicit final launch approval was recorded locally in the ignored evidence env file. Compact launch readiness with the Preview env file reports `11 ready / 0 blocked / 1 warning`; `overall=ready`.
    Validate with: `npm run launch:readiness -- --summary`, strict public smoke, admin-flow smoke, monitoring confirmation, 24-48 hour review.

## Automatic Rollover Rule

When step 13 is complete, do this in the same local change:

1. Move this roadmap to `docs/codex/archive/roadmap/YYYY-MM-DD-fully-live-end-product.md`.
2. Create a fresh `docs/codex/roadmap.md` for the next operating phase.
3. Seed the successor roadmap with ordered steps for coverage growth, quality operations, user feedback, analytics, and reliability improvements.
4. Update `docs/codex/handoff.md` with the archive path and new roadmap target.
5. Commit and push when useful.
