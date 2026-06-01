# Plan: Prisma-backed dashboard reads

- Goal: Move the dashboard behind a server-side data boundary that can read from Prisma/PostgreSQL and fall back to seed data when the local database is unavailable.
- Constraints: Keep the public read-only UI working without local Postgres; do not import Prisma into client components; preserve Australia/TGA and citation guardrails.
- Done condition: The dashboard renders from a data bundle prop, Prisma mapping compiles, seed fallback works, and validation passes without a running database.
- Files likely touched: `src/app/page.tsx`, `src/components/evidence-dashboard.tsx`, `src/lib/data/`, `src/lib/types.ts`.
- Steps:
  - Add dashboard data bundle type.
  - Create seed and Prisma data loaders.
  - Refactor the client dashboard to accept data as props.
  - Show source/fallback status subtly in the UI.
- Validation: `npm run db:validate`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, browser smoke check.
- Risks: Prisma enum mapping drift; accidental Prisma import into client bundle; build-time DB connection failures.

## Result

- Status: Completed initial data boundary.
- Dashboard route is dynamic and receives a server-loaded data bundle.
- Prisma reads are attempted only when PostgreSQL is reachable; otherwise the UI shows a seed-fallback status.
- Validation run: `npm run db:validate`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, and Playwright snapshot.
