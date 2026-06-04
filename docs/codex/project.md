# Project Memory

Keep this file as compact, stable Codex state. Put command catalogs in dedicated docs, current thread state in `docs/codex/handoff.md`, and completed plan detail in `docs/codex/plans/archive/`.

## Shape

- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma, Node/npm.
- App Router lives under `src/app/`; dashboard UI is in `src/components/evidence-dashboard.tsx`.
- Domain types, seed data, scoring, regulatory labels, and data helpers live under `src/lib/`.
- Public source wrappers live under `src/lib/integrations/`; public API routes live under `src/app/api/`.
- Prisma schema, migrations, and seed script live under `prisma/`.

## Commands

- Install/dev: `npm install`, `npm run dev`, `npm run dev:stop`.
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:push`, `npm run db:seed`.
- Local PostgreSQL: `docker compose up -d postgres`, `docker compose ps`, `docker compose down`; reset with `docker compose down -v`.
- Local source-candidate ingestion: `npm run ingest:sources`; use `npm run ingest:sources -- --help` and `docs/codex/source-candidate-workflow.md` for modes and output rules.

## Data And Boundaries

- MVP mode is public read-only; admin/review writes stay local operator-only.
- Dashboard reads through `src/lib/data/dashboard.ts`; it prefers Prisma when PostgreSQL is reachable and falls back to seed data unless `APEX_DATA_SOURCE=database`.
- Prisma migrations are the reproducible database path; reserve `db:push` for temporary local prototypes.
- `prisma/seed.ts` runs integrity checks so missing required seed IDs or stale seed-owned IDs fail loudly.
- Public live-source API routes must stay read-only and must not import or call source-candidate persistence.
- Live PubMed and ClinicalTrials.gov previews are unreviewed leads; `/100` values are triage scores, not evidence quality.
- Source-candidate ingestion/review writes live under `npm run ingest:sources` only.
- Accepted source candidates require a matching curated reference and do not auto-promote into public evidence cards.
- Guarded post-review curation writes are `--link-candidate-claim` for `ClaimReference` and `--extract-candidate-study` for `Study`; neither creates references, source documents, decisions, or public promotions.

## Product Rules

- Default regulatory lens: Australia/TGA.
- Do not infer ARTG/AUST status from generic intervention evidence; product-level confidence needs product-level evidence.
- Product labels should show product-market context separately from AU/TGA status.
- Evidence cards stay consumer-friendly by default and citation-traceable, with review status visible.
- Label-risk empty states say no local warnings were found; they do not imply safety, efficacy, or TGA clearance.
- Claim score table rows stay mouse/keyboard selectable and include source-packet completeness.

## Validation

- Use the matrix in `docs/codex/workflow.md`; run targeted checks first, then broader checks according to risk.
- On Windows, stop the dev server with `npm run dev:stop` before Prisma-generating checks such as `npm run typecheck` or `npm run build`.
- Include `db:validate`/`db:generate` for Prisma schema, migration, or generated-client changes.
- Run `docker compose config` after Compose changes and `npm audit` after dependency changes.

## Local Database Assumptions

- `.env.example` points Prisma at `postgresql://postgres:postgres@localhost:5432/apex_lifespan?schema=public`.
- Docker Desktop or Docker Compose must be available locally.
- The default `postgres/postgres` credentials are development-only.
- If port `5432` is occupied, change the Compose host port and local `.env` `DATABASE_URL` together.

## Risk Areas

- Medical claim accuracy and currentness.
- Citation traceability and human review status.
- ARTG/AUST status accuracy for Australia-facing product claims.
- Peptide/drug regulatory guardrails and avoiding individualized medical advice.
- Package advisories in the frontend toolchain.

## Open Questions

- First production deployment target.
