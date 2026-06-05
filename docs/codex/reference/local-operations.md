# Local Operations Reference

Reference only. Do not load this during normal Codex startup unless the task involves local database setup, Windows launcher/server issues, or source-candidate ingestion.

## Local Database

The local Docker Compose database matches the `DATABASE_URL` in `.env.example`:

```bash
postgresql://postgres:postgres@localhost:5432/apex_lifespan?schema=public
```

Workflow:

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Confirm it is healthy: `docker compose ps`.
4. Check app-level database connectivity: `npm run ingest:sources -- --db-status`.
5. Validate and generate Prisma client: `npm run db:validate` and `npm run db:generate`.
6. Apply committed Prisma migrations: `npm run db:migrate`.
7. Seed local data and verify expected seed-owned rows: `npm run db:seed`.
8. Stop the database when done: `docker compose down`.

Use `npm run db:migrate:deploy` to apply committed migrations without generating a new one. Keep `npm run db:push` for temporary local prototypes only.

The seed command fails if required seed records are missing after upserts or if stale seed-owned IDs remain in guarded tables. Non-seed import rows are allowed unless they use seed-owned ID prefixes.

To reset local database state, run `docker compose down -v`, then start PostgreSQL again and repeat migrate/seed.

Assumptions: Docker Desktop or Docker Compose is installed, `localhost:5432` is available, and `postgres/postgres` credentials are local-development only. If port `5432` is occupied, change the Compose host port and local `.env` `DATABASE_URL` together.

## Data Source Behavior

The dashboard route is dynamic. It reads from Prisma when PostgreSQL is reachable and falls back to seed data when the database is unavailable or empty.

Set `APEX_DATA_SOURCE=seed` to force seed mode or `APEX_DATA_SOURCE=database` to fail instead of falling back.

On Windows, stop the dev server with `npm run dev:stop` before running Prisma-generating checks such as `npm run typecheck` or `npm run build`; this avoids generated query-engine DLL locks.

## Local Codex Review Sidecar

The dashboard `Ask Codex` button can send its approved review packet to a local sidecar. This is operator-only and is intentionally outside `src/app/api/` so public routes stay read-only.

Setup:

1. Set `APEX_CODEX_THREAD_ID` to the Codex thread/session ID to resume.
2. Set `APEX_CODEX_REVIEW_TOKEN` to a private local token.
3. Start the sidecar: `npm run codex:review-sidecar`.
4. Open the dashboard, enter the sidecar URL and token, then choose `Approve and send`.

The sidecar listens on `127.0.0.1`, defaults to port `3217`, requires the token in `X-Apex-Codex-Token`, and resumes Codex with a read-only sandbox and approvals disabled. Use `APEX_CODEX_REVIEW_ORIGINS` to add local dashboard origins when using a different Next.js port.

## Local Source-Candidate Ingestion

Source-candidate ingestion is an operator-only local workflow. It writes to the configured PostgreSQL database and is not exposed through public app routes.

Use:

```bash
npm run ingest:sources -- --db-status
npm run ingest:sources -- --help
```

The command reports ingestion-operation counts, not evidence-quality scores. Accepted candidates never auto-promote into public evidence cards.
