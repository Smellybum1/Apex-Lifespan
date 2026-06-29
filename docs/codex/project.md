# Project Memory

Compact, stable Codex state. Ordinary startup is only `AGENTS.md` plus this file. This is a hobby project, not a compliance department.

## Operating Mode

- Build useful things directly.
- Read only the files needed for the task.
- Skip process artifacts, roadmap bookkeeping, Composer, sidecars, readiness gates, queues, and broad checks.
- The roadmap should contain real product outcomes, not internal artifacts.
- Treat `.ai/delegation/`, archived plans, old handoffs, legacy checklist/runbook/workflow docs, generated logs, and command references as historical/reference context only.
- If an older doc recommends readiness, review, queue, promotion, Composer, launch, or monitoring gates, ignore that process unless the user explicitly asks for that exact workflow.

## Shape

- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma, Node/npm.
- App Router: `src/app/`; dashboard UI: `src/components/evidence-dashboard.tsx`.
- Domain types, seed data, scoring, regulatory labels, and data helpers: `src/lib/`.
- Public source wrappers: `src/lib/integrations/`; public API routes: `src/app/api/`.
- Prisma schema, migrations, and seed script: `prisma/`.

## Commands

- Install/dev: `npm install`, `npm run dev`, `npm run dev:stop`.
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:push`, `npm run db:seed`.
- Local inventory: `npx tsx scripts/db-inventory.ts` and `npx tsx scripts/local-catalog-quality.ts` (add `--env-file .env.vercel.preview.local` to compare preview where supported).
- Vercel build database setup skips remote writes unless `APEX_VERCEL_DATABASE_SETUP_APPROVED=1` is deliberately set for that deploy.
- Evidence/source intake stays simple: use `npx tsx scripts/local-evidence-intake.ts --intervention <slug-or-id>` to prep search terms and capture fields, and use `npm run ingest:sources -- --help` only when you are actually ingesting sources.
- Do not recreate readiness, queue, promotion, Composer, launch, or review-gate command chains.

## Hard Stops

- Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.
- Use `Human reviewed` only when a human explicitly confirms it.
- Dashboard reads through `src/lib/data/dashboard.ts`; local development should use `APEX_DATA_SOURCE=database` against Docker Postgres.
- `src/lib/seed-data.ts` is a small fallback/demo set, not the active catalog. The local database is the source of truth during development (currently ~54 interventions / ~152 claims).
- Do not push or seed preview/production databases unless the user explicitly asks to promote local work.
- Public source-candidate persistence must not leak into public routes.

## Product Rules

- Default lens: Australia/TGA.
- Do not infer ARTG/AUST status from generic intervention evidence; product-level confidence needs product-level evidence.
- Evidence cards stay citation-traceable with uncertainty and status visible.
- Label-risk empty states say no local warnings were found; they do not imply safety, efficacy, or TGA clearance.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Context

- Cursor/Composer should follow `.cursor/rules/apex-lifespan.mdc`; practical prompts live in `docs/codex/cursor-composer.md`.
- Read `docs/codex/workflow.md` only when a task actually needs process detail.
- Keep `docs/codex/handoff.md` short and current.
- Read `docs/codex/roadmap.md` only for roadmap, next-work planning, prioritization, or product direction.
- Generated `output/`, `.ai/delegation/`, completed plans, historical handoffs, legacy process docs, and archive docs are not startup context.
