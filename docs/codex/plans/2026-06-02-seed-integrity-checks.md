# Plan: Seed integrity checks

- Goal: Make `npm run db:seed` fail loudly when the connected database is missing expected seed-owned records or still contains stale seed-owned rows.
- Constraints: Keep the check local and deterministic; do not require Docker/Postgres in this environment for validation.
- Done condition: Seed integrity logic is test-covered, `prisma/seed.ts` runs it after seeding, and docs record the guardrail.
- Files likely touched: `src/lib/seed-integrity.ts`, `src/lib/seed-integrity.test.ts`, `prisma/seed.ts`, `README.md`, `docs/codex/project.md`.
- Steps:
  - Add pure seed integrity helpers that compare expected and actual IDs.
  - Treat missing required seed IDs as failures.
  - Treat stale seed-owned rows as failures without blocking future non-seed ingestion rows.
  - Wire the helper into the Prisma seed script after all upserts.
  - Validate with tests, lint, typecheck, build, and schema validation.
- Risks: Live DB seed verification still cannot be exercised here without PostgreSQL.

## Result

- Status: Completed seed integrity guard slice.
- Added reusable seed integrity helpers for missing expected IDs and stale seed-owned IDs.
- Wired `prisma/seed.ts` to verify references, interventions, claims, claim references, studies, trials, safety alerts, products, AU regulatory statuses, and seed ingestion jobs after upserts.
- The guard allows non-seed extra rows unless they use configured seed-owned prefixes.
- Updated README and project memory so `db:seed` is documented as a seed-and-verify step.
- Validation run: `npm run test`, `npm run db:validate`, `npm run lint`, `npm audit`, `npm run typecheck`, and `npm run build`.
- Remaining limitation: live `npm run db:seed` could not be run here because PostgreSQL/Docker is unavailable.
