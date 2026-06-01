# Plan: Prisma migration baseline

- Goal: Make the current PostgreSQL schema reproducible through Prisma migrations instead of relying only on `db push`.
- Constraints: Do not require a live Docker/Postgres instance in this environment; generate and validate the migration from the Prisma schema.
- Done condition: `prisma/migrations` contains a baseline SQL migration matching the current schema, package scripts expose migrate commands, and README/project memory describe the local workflow.
- Files likely touched: `prisma/migrations/**/migration.sql`, `package.json`, `README.md`, `docs/codex/project.md`.
- Steps:
  - Generate an initial SQL migration from the current Prisma datamodel.
  - Add clear npm scripts for local migration and deploy-style migration use.
  - Update docs so local setup prefers migrate/seed for reproducible database state.
  - Validate schema, type generation, tests, lint, and build.
- Risks: The migration cannot be applied to a live database here because Docker/Postgres is not available.
- Notes: The AU regulatory status uniqueness rules need hand-authored PostgreSQL partial indexes because normal unique indexes treat nullable values as distinct.

## Result

- Status: Completed migration baseline slice.
- Added initial Prisma migration SQL for the current schema.
- Added hand-authored partial unique indexes for AU regulatory status rows with nullable product/intervention/ARTG fields.
- Added npm scripts for local migrations and deploy-style committed migration application.
- Updated README and project memory to make migrations the default local database workflow.
- Validation run: migration SQL regenerated from schema as a baseline before adding partial indexes, `npm run db:validate`, `npm run test`, `npm run lint`, `npm audit`, `npm run typecheck`, and `npm run build`.
- Remaining limitation: live `npm run db:migrate` and `npm run db:seed` could not be run here because Docker/Postgres is unavailable.
