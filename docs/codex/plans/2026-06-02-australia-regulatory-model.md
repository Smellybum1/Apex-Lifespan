# Plan: Australia regulatory model

- Goal: Make Australia/TGA regulatory status structured instead of mostly free text.
- Constraints: Use TGA concepts only where supported by source evidence; avoid claiming a seed product is ARTG-listed unless an ARTG/AUST number is known.
- Done condition: Prisma schema, seed data, dashboard data loader, UI, and tests understand AU regulatory status kinds such as AUST L, AUST L(A), AUST R, unapproved/not in ARTG, exempt, excluded, and unknown.
- Files likely touched: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/types.ts`, `src/lib/seed-data.ts`, `src/lib/data/dashboard.ts`, `src/components/evidence-dashboard.tsx`, tests/docs.
- Steps:
  - Add AU regulatory enum/model and relationships.
  - Add typed seed statuses with TGA source references.
  - Map Prisma records into dashboard data.
  - Surface current intervention AU status and product ARTG verification status.
  - Add focused tests around AU regulatory helper behavior.
- Validation: `npm run db:validate`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, browser smoke check.
- Risks: Overstating ARTG status for generic interventions or seed products; DB migration not run without Docker/Postgres.

## Result

- Status: Completed structured AU/TGA model slice.
- Added Prisma `AustraliaRegulatoryKind` and `AustraliaRegulatoryStatus` records.
- Added typed seed status records for interventions and seed products.
- Dashboard shows active intervention AU/TGA status and product-level ARTG verification chips without widening the claim table.
- Validation run: `npm run db:validate`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, and Playwright smoke check.
