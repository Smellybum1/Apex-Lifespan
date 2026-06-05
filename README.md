# Apex Lifespan

Apex Lifespan is an evidence intelligence dashboard for supplements, peptides, and healthspan interventions. It scores intervention-claim pairs rather than whole compounds, keeps uncertainty visible, and separates supplements from therapeutic or regulatory-risk interventions.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Table
- Recharts
- PostgreSQL
- Prisma

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Stop dev server on port 3000: `npm run dev:stop`
- Test: `npm run test`
- Lint/typecheck/build: `npm run lint`, `npm run typecheck`, `npm run build`
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:push`, `npm run db:seed`
- Local source-candidate CLI: `npm run ingest:sources`

## Local Setup

Copy `.env.example` to `.env`, start PostgreSQL with `docker compose up -d postgres`, then run `npm run db:migrate` and `npm run db:seed`.

The dashboard route reads from Prisma when PostgreSQL is reachable and falls back to seed data when unavailable or empty. Set `APEX_DATA_SOURCE=seed` to force seed mode or `APEX_DATA_SOURCE=database` to fail instead of falling back.

Detailed local database, Windows DLL-lock, reset, and ingestion workflows live in `docs/codex/reference/local-operations.md`.

## Local Ingestion

Source-candidate ingestion is an operator-only local workflow. It writes to the configured PostgreSQL database and is not exposed through public app routes.

Use the built-in help for the current flag list:

```bash
npm run ingest:sources -- --help
```

Before reviewing or queueing candidates, check local PostgreSQL connectivity:

```bash
npm run ingest:sources -- --db-status
```

For queueing, review, curation, and safety rules, see `docs/codex/source-candidate-workflow.md`. For the full command catalog, see `docs/codex/reference/source-candidate-command-reference.md`.

## Australia Regulatory Lens

Apex Lifespan tracks Australia/TGA regulatory status separately from evidence scores. Generic intervention evidence does not imply a product is legal to supply in Australia. Product-level confidence should come from an ARTG/AUST number.

## Safety Boundaries

- General public resource only.
- Public read-only MVP; admin review can come later.
- Australia/TGA is the first regulatory lens.
- No individualized medical advice.
- No sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance for unapproved drugs or peptides.
- Every evidence card must stay traceable to citations and human review status.
