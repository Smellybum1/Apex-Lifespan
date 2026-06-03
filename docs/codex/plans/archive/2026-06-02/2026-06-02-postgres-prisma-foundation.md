# Plan: PostgreSQL and Prisma foundation

- Goal: Add a PostgreSQL + Prisma persistence foundation for the public read-only Apex Lifespan MVP.
- Constraints: Australia/TGA is the first regulatory lens; keep public-facing content general and non-personalized; keep peptide guardrails explicit.
- Done condition: Prisma schema validates/generates, seed script can load current MVP data into PostgreSQL when `DATABASE_URL` is configured, and project docs/commands reflect the chosen direction.
- Files likely touched: `package.json`, `prisma/`, `.env.example`, `src/lib/`, `README.md`, `AGENTS.md`, `docs/codex/project.md`.
- Steps:
  - Install Prisma dependencies.
  - Create schema for interventions, claims, studies, trials, safety alerts, products, source documents, ingestion jobs, and review audit fields.
  - Add a seed script mapping existing seed data into the schema.
  - Add shared app configuration for default Australia/public read-only settings.
  - Update docs and validation commands.
- Validation: `npx prisma validate`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`.
- Risks: Local PostgreSQL depends on Docker Compose being available and `localhost:5432` being free.

## Result

- Status: Completed foundation.
- Validation run: `npm run db:validate`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`.
- Not run: `npm run db:push` and `npm run db:seed`, because no local PostgreSQL listener was present on port 5432.
- Direction captured: public read-only MVP, PostgreSQL + Prisma, Australia/TGA default lens, PubMed-first ingestion, consumer-friendly UI with planned expandable research detail.

## Local PostgreSQL developer ergonomics update

- Goal: Add a Docker Compose PostgreSQL service that matches the Prisma `DATABASE_URL` in `.env.example`.
- Constraints: Do not change application code or `prisma/schema.prisma`; keep this to local developer ergonomics.
- Done condition: Compose can render a valid configuration, docs describe start/push/seed/stop/reset workflow, and assumptions are explicit.
- Files likely touched: `docker-compose.yml`, `.env.example`, `README.md`, `docs/codex/project.md`, `docs/codex/plans/2026-06-02-postgres-prisma-foundation.md`.
- Steps:
  - Add a `postgres` service with database `apex_lifespan`, user `postgres`, password `postgres`, host port `5432`, a named data volume, and a readiness healthcheck.
  - Keep `.env.example` aligned to the Compose service.
  - Document the local Prisma database workflow and reset path.
- Validation: `docker compose config`; optionally `npm run db:validate` because it does not require a running database.
- Assumptions: Docker Desktop or Docker Compose is installed locally, port `5432` is available, and these credentials are development-only.
- Result: Added local PostgreSQL Compose ergonomics and aligned docs/env guidance. `npm run db:validate` passed, a fallback YAML parse/field check passed, and `docker compose config`/`docker-compose config` could not run because Docker Compose was not installed or not on PATH in this environment.
