# Apex Lifespan

Apex Lifespan is a local-first evidence intelligence dashboard for supplements, peptides, and healthspan interventions. It scores intervention-claim pairs rather than whole compounds, keeps uncertainty visible, and separates generic evidence from product-level Australia/TGA status.

## Stack

- Next.js, TypeScript, Tailwind CSS
- TanStack Table, Recharts
- PostgreSQL, Prisma

## Commands

- Install/dev: `npm install`, `npm run dev`, `npm run dev:stop`
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:push`, `npm run db:seed`
- Local source-candidate CLI: `npm run ingest:sources -- --help`

## Local Setup

Copy `.env.example` to `.env`, start PostgreSQL with `docker compose up -d postgres`, then run `npm run db:migrate` and `npm run db:seed`.

The dashboard reads from Prisma when PostgreSQL is reachable and falls back to seed data when unavailable or empty. Set `APEX_DATA_SOURCE=database` for normal local catalog work.

Detailed local database, Windows DLL-lock, reset, and ingestion notes live in `docs/codex/reference/local-operations.md`.

## Current Workflow

Work against the local database catalog first. Public/preview/production promotion is separate and requires an explicit user request.

For Codex context, ordinary startup is only `AGENTS.md` plus `docs/codex/project.md`. Use `docs/codex/roadmap.md` only for roadmap or next-work planning, and `docs/codex/handoff.md` only when resuming a thread.

## Local Ingestion

Source-candidate ingestion is local/operator-only and writes to the configured PostgreSQL database. Public app routes must stay read-only.

Check local DB connectivity before queueing or reviewing candidates:

```bash
npm run ingest:sources -- --db-status
```

For the compact workflow, see `docs/codex/source-candidate-workflow.md`. Full command references under `docs/codex/reference/` are reference-only.

## Safety Boundaries

- General public resource only; no individualized medical advice.
- Australia/TGA is the default regulatory lens.
- Generic intervention evidence does not imply ARTG/AUST product status.
- Product-level confidence needs product-level evidence.
- Avoid sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance for unapproved drugs or peptides.
- Evidence cards must stay citation-traceable with uncertainty and review status visible.

Historical public launch, provisioning, operations, and checklist docs under `docs/codex/` are reference-only unless the user explicitly asks for deployment or production work.
