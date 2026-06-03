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
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Run queued source-candidate ingestion jobs locally: `npm run ingest:sources`
- Prisma validate: `npm run db:validate`
- Prisma generate: `npm run db:generate`
- Apply local Prisma migrations: `npm run db:migrate`
- Apply committed migrations without creating new ones: `npm run db:migrate:deploy`
- Push schema to configured PostgreSQL without migrations: `npm run db:push`
- Seed configured PostgreSQL and verify seed-owned IDs: `npm run db:seed`

## Local database

The local Docker Compose database matches the `DATABASE_URL` in `.env.example`:

```bash
postgresql://postgres:postgres@localhost:5432/apex_lifespan?schema=public
```

Workflow:

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Confirm it is healthy: `docker compose ps`
4. Validate and generate Prisma client: `npm run db:validate` and `npm run db:generate`
5. Apply the committed Prisma migrations: `npm run db:migrate`
6. Seed local data and verify expected seed-owned rows: `npm run db:seed`
7. Stop the database when done: `docker compose down`

Use `npm run db:migrate:deploy` when you want to apply committed migrations without generating a new migration. Keep `npm run db:push` for temporary local prototypes only.

The seed command fails if required seed records are missing after the upserts or if stale seed-owned IDs remain in guarded tables. Non-seed import rows are allowed unless they use the seed-owned ID prefixes.

To reset local database state, run `docker compose down -v`, then start PostgreSQL again and repeat the migrate/seed steps.

Assumptions: Docker Desktop or Docker Compose is installed, `localhost:5432` is available, and the `postgres/postgres` credentials are local-development only. If port `5432` is already in use, change the host port in `docker-compose.yml` and update `DATABASE_URL` in `.env` to match.

## Data source behavior

The dashboard route is dynamic. It checks whether PostgreSQL is reachable, reads from Prisma when available, and falls back to seed data when the database is unavailable or empty. Set `APEX_DATA_SOURCE=seed` to force seed mode or `APEX_DATA_SOURCE=database` to fail instead of falling back.

On Windows, stop the dev server with `npm run dev:stop` before running Prisma-generating checks such as `npm run typecheck` or `npm run build`; this avoids generated query-engine DLL locks without needing PID-specific stop commands.

## Local ingestion

Source-candidate ingestion is an operator-only local workflow. It writes to the configured PostgreSQL database and is not exposed through public app routes.

Use the built-in help and the dedicated workflow doc as the command reference:

```bash
npm run ingest:sources -- --help
```

See `docs/codex/source-candidate-workflow.md` for queueing, review, curation, output, and safety rules.

Common examples:

```bash
npm run ingest:sources
npm run ingest:sources -- --queue-pubmed "creatine strength randomized trial systematic review"
npm run ingest:sources -- --jobs
npm run ingest:sources -- --candidates
npm run ingest:sources -- --candidate-detail <dedupe-key>
npm run ingest:sources -- --candidate-curation-handoff
npm run ingest:sources -- --accept-candidate <dedupe-key> --accepted-reference-id <reference-id>
npm run ingest:sources -- --reject-candidate <dedupe-key> --review-note "Not relevant to this claim."
```

The command reports ingestion-operation counts, not evidence-quality scores. Accepted candidates never auto-promote into public evidence cards.

## Australia regulatory lens

Apex Lifespan tracks Australia/TGA regulatory status separately from evidence scores. Generic intervention evidence does not imply a product is legal to supply in Australia. Product-level confidence should come from an ARTG/AUST number:

- `AUST L`: listed medicine; quality and safety requirements apply, but efficacy is not individually assessed before listing.
- `AUST L(A)`: assessed listed medicine; health claims have pre-market efficacy assessment.
- `AUST R`: registered medicine; quality, safety, and efficacy are assessed before registration.
- Unknown or unapproved states stay visible until the product label or ARTG record is verified.

## Safety boundaries

- General public resource only.
- Public read-only MVP; admin review can come later.
- Australia/TGA is the first regulatory lens.
- No individualized medical advice.
- No sourcing, compounding, reconstitution, injection, cycling, or self-administration guidance for unapproved drugs or peptides.
- Every evidence card must stay traceable to citations and human review status.
