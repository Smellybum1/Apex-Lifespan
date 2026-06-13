# Project Memory

Compact, stable Codex state. Do not turn this into a command catalog or progress log.

## Shape

- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma, Node/npm.
- App Router: `src/app/`; dashboard UI: `src/components/evidence-dashboard.tsx`.
- Domain types, seed data, scoring, regulatory labels, and data helpers: `src/lib/`.
- Public source wrappers: `src/lib/integrations/`; public API routes: `src/app/api/`.
- Prisma schema, migrations, and seed script: `prisma/`.

## Commands

- Install/dev: `npm install`, `npm run dev`, `npm run dev:stop`.
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:push`, `npm run db:seed`.
- Source-candidate CLI: `npm run ingest:sources -- --help`; open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Codex review sidecar: `npm run codex:review-sidecar` for token-gated local dashboard packets.

## Boundaries

- Public app surfaces are read-only; review/admin writes stay local operator-only.
- Dashboard reads through `src/lib/data/dashboard.ts`; it prefers Prisma when reachable and falls back to seed data unless `APEX_DATA_SOURCE=database`.
- Public live-source API routes must not import or call source-candidate persistence.
- Dashboard-to-Codex packet sends go through the local sidecar, not public Next.js API routes.
- Live PubMed and ClinicalTrials.gov previews are unreviewed leads; `/100` values are triage scores, not evidence quality.
- Source-candidate writes live only under `npm run ingest:sources`; accept/reject and curation writes remain human-reviewed and never auto-promote public evidence.

## Product Rules

- Default lens: Australia/TGA.
- Do not infer ARTG/AUST status from generic intervention evidence; product-level confidence needs product-level evidence.
- Evidence cards stay citation-traceable with review status visible.
- Label-risk empty states say no local warnings were found; they do not imply safety, efficacy, or TGA clearance.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Iteration

- Use `docs/codex/workflow.md` for the compact loop and validation hints.
- Do not open `docs/codex/roadmap.md` during startup unless the task asks for roadmap, next-work planning, prioritization, or product direction.
- Default site/product iteration is local-first: use `npm run dev`, review at localhost, and avoid redeploying for every small tweak.
- Batch UI/content changes into checkpoints. The user now means Production when saying "deploy to Vercel"; use Vercel Preview only when they explicitly ask for Preview or a shareable review URL before Production.
- If a production hotfix is needed while the working branch is dirty, use a clean worktree from current `origin/main` and ship only the intentional hotfix.
- Inline plans are enough for ordinary work, even across a few files.
- Create `docs/codex/plans/` files only for genuinely risky, unclear, schema/API/security, public-boundary, or hard-to-validate changes.
- On Windows, run `npm run dev:stop` before Prisma-generating checks such as `npm run typecheck` or `npm run build`.
- Include `db:validate`/`db:generate` for Prisma schema, migration, or generated-client changes.
- Run `docker compose config` after Compose changes and `npm audit` after dependency changes.

## Reference Docs

- Roadmap, only for planning/next-work tasks: `docs/codex/roadmap.md`.
- Evidence roadmap reference, only for schema/ingestion/expansion strategy: `docs/codex/reference/evidence-product-roadmap-reference.md`.
- Supplement onboarding hub: `docs/codex/supplement-onboarding.md`; command reference only for onboarding work: `docs/codex/reference/supplement-onboarding-command-reference.md`.
- Local DB and operator setup: `docs/codex/reference/local-operations.md`.
- Full source-candidate command catalog: `docs/codex/reference/source-candidate-command-reference.md`.
- Current/resume-only state: `docs/codex/handoff.md`.
- Completed plans and historical handoffs are archive context; search them only for targeted evidence.
