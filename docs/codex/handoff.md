# Thread Handoff

Refreshed on 2026-06-13 after the context-efficiency cleanup. Keep this file compact; archive chronology instead of extending this file.

Full pre-cleanup history is archived at `docs/codex/archive/handoff/2026-06-13-fully-live-and-onboarding-history.md`.

## Startup

- Work in `D:\Codex\Apex Lifespan` on branch `codex/queue-claim-sources`.
- Read `AGENTS.md` and `docs/codex/project.md` first. Read this file only for resume/current state.
- Do not read archives, generated output, screenshots, plans, or reference command catalogs wholesale. Search them only for targeted history.
- Use `docs/codex/roadmap.md` only when the task asks for roadmap, next-work, prioritization, or product planning.

## Current State

- Public URL: `https://apex-lifespan.vercel.app`.
- Production is database-backed and public routes remain read-only.
- Production operator auth is configured; anonymous `/operator` should show the GitHub sign-in gate.
- Production writes remain disabled by default unless an explicit reviewed operator gate is enabled.
- Latest local branch commit: `417c055 Clean operator QA fixture before preview seed`.
- Production `main` includes auth hotfix `68981fe` and later trust-label/smoke-helper work.
- This branch has substantial uncommitted launch, onboarding, trust-polish, roadmap, schema, and operator workflow work; run `git status -sb` before staging.
- GitHub pushing is allowed when useful, but do not commit or push this cleanup unless the user asks.

## Guardrails

- Public routes and dashboard remain read-only.
- Manual evidence/source-candidate workflows stay explicit and human-owned.
- No source-candidate auto-promotion into public evidence.
- Operator writes require authenticated operator role plus explicit write/evidence gates.
- Keep local Codex sidecar variables out of public/Vercel environments.
- Australia/TGA remains the default lens; product-level ARTG/AUST confidence needs product-level evidence.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Current Work

- Fully-live launch is complete and archived.
- Post-launch review remains scheduled for Sunday, June 14, 2026 at 2:00 PM Australia/Brisbane.
- Stabilization checkpoints are recurring: organize local work into intentional commits/PRs before production deploys, PRs, handoffs, or major roadmap transitions.
- Active product roadmap starts at Sprint 2: data-model hardening, backfill/import helpers, dashboard/detail hydration from normalized tables, and operator workflows for review events and score snapshots.
- Onboarding automation is feature-rich; use the compact hub `docs/codex/supplement-onboarding.md` and open the command reference only for onboarding work.

## Validation Baseline

- Recent full validation for launch/onboarding/trust work included focused tests, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, and production public smoke.
- Data-model foundation validation passed: `npm run db:validate`, `npm run db:generate`, `npm run typecheck`, focused tests, and `git diff --check`.
- For docs-only context edits, use diff review plus `git diff --check`.

## Useful Commands

- Status: `git status -sb`, `git log --oneline -5 --decorate`.
- Local iteration: `npm run dev`, then review localhost; batch small UI/content changes before deploying.
- Production public smoke: `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app --require-database`.
- Operator auth smoke: `npm run operator:smoke -- https://apex-lifespan.vercel.app --expect-auth-required`.
- Readiness summaries: `npm run launch:readiness -- --summary`, `npm run production:readiness -- --summary`, `npm run operator:readiness -- --summary`, `npm run operations:readiness -- --summary`, `npm run coverage:review -- --summary`.
- Onboarding happy path: `npm run onboarding:guide -- --supplement <id-or-slug> --summary` or `npm run onboarding:guide -- --name <supplement> --summary`.
- Validation: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`.
