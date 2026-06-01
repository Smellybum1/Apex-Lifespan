# Source Candidate Ingestion Helper

- Goal: Add internal helper functions that fetch PubMed or ClinicalTrials.gov results, map them to source candidates, and persist them through the gated upsert helper.
- Constraints: Keep public GET preview routes read-only, keep persistence opt-in from server-side ingestion code only, and preserve candidate triage/review semantics.
- Done condition: PubMed and ClinicalTrials.gov ingestion helpers compose live-source search, candidate mapping, and candidate upsert with tests proving the expected calls and outputs.
- Files likely touched: `src/lib/data/source-candidate-ingestion.ts`, tests, `docs/codex/project.md`.
- Steps:
  - Add typed ingestion inputs and result summaries.
  - Implement PubMed and ClinicalTrials.gov candidate ingestion helpers.
  - Mock live integrations and upsert helper in tests.
  - Run targeted tests, full tests, lint, typecheck, build, and HTTP smoke.
- Risks: Future callers must keep this out of public unauthenticated GET routes.
