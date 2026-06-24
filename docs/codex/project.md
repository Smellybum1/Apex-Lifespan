# Project Memory

Compact, stable Codex state. Keep this file small. This project is a hobby project, not a compliance department.

## Operating Mode

- Build useful things directly.
- Read only the files needed for the task.
- Skip process artifacts, roadmap bookkeeping, Composer, sidecars, readiness gates, queues, and broad checks.
- The roadmap should contain real product outcomes, not internal artifacts.
- Remove process when it starts creating more process.

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
- Evidence/source intake stays simple: use `npm run ingest:sources -- --help` only when you are actually ingesting sources.
- Do not recreate readiness, queue, promotion, Composer, launch, or review-gate command chains.

## Hard Stops

- Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.
- Use `Human reviewed` only when a human explicitly confirms it.
- Dashboard reads through `src/lib/data/dashboard.ts`; it prefers Prisma when reachable and falls back to seed data unless `APEX_DATA_SOURCE=database`.
- Public source-candidate persistence must not leak into public routes.
- Dashboard-to-Codex packet sends go through the local sidecar, not public Next.js API routes.

## Product Rules

- Default lens: Australia/TGA.
- Do not infer ARTG/AUST status from generic intervention evidence; product-level confidence needs product-level evidence.
- Evidence cards stay citation-traceable with uncertainty and status visible.
- Label-risk empty states say no local warnings were found; they do not imply safety, efficacy, or TGA clearance.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Context

- Read `docs/codex/workflow.md` only when a task actually needs process detail.
- Keep `docs/codex/handoff.md` short and current.
- Read `docs/codex/roadmap.md` only for roadmap, next-work planning, prioritization, or product direction.
- Generated `output/`, completed plans, historical handoffs, and archive docs are not startup context.
