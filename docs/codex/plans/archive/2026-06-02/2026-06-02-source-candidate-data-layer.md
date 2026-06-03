# Source Candidate Data Layer

- Goal: Add a backend-only persistence target for live PubMed and ClinicalTrials.gov candidates before curated review.
- Constraints: Keep the public dashboard read-only, do not auto-persist live preview results, and keep candidate `/100` values as triage scores rather than evidence quality.
- Done condition: Prisma has a source-candidate model/migration, pure helpers map live-source results into unreviewed candidate drafts, and tests cover PubMed and ClinicalTrials.gov mapping.
- Files likely touched: `prisma/schema.prisma`, a new migration, `src/lib/source-candidates.ts`, tests, `src/lib/types.ts`, `docs/codex/project.md`.
- Steps:
  - Add the Prisma model and migration for source candidates.
  - Add domain types and pure mapping helpers from existing live-source result types.
  - Test that candidates remain unreviewed and preserve triage metadata.
  - Run Prisma validation/generation, tests, lint, typecheck, and build.
- Risks: Avoid implying that live candidates are curated references or reviewed evidence.
