# Plan: MVP scaffold

- Goal: Create the initial Apex Lifespan web dashboard MVP foundation from the provided product spec.
- Constraints: Keep medical content general and citation-oriented; do not provide individualized advice or peptide sourcing/reconstitution/injection/cycling/self-administration guidance.
- Done condition: Repo is initialized, the app can install/build, and the first screen demonstrates claim-scored evidence cards, safety/regulatory flags, evidence map, trial watcher, safety center, and label analyzer entry points using seed data.
- Files likely touched: `package.json`, Next.js app files, `src/` data/types/scoring modules, docs/codex project memory, git config files.
- Steps:
  - Initialize git and attach the empty GitHub remote.
  - Scaffold Next.js + TypeScript + Tailwind.
  - Add domain types, seed interventions/claims/studies/trials/alerts/products, and scoring helpers.
  - Build dashboard UI focused on evidence transparency and safety boundaries.
  - Add README and update project memory with discovered commands.
- Validation: `npm install`, `npm run lint`, `npm run build`.
- Risks: External package install may fail; generated medical copy must remain general, caveated, and citation-oriented.

## Result

- Status: Completed initial scaffold.
- Validation run: `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit`, Playwright snapshot, and live API route smoke checks.
- Open item: Add a test framework once the first persistence or scoring workflow needs regression coverage.
