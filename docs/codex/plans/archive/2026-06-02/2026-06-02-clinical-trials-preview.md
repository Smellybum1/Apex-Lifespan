# Plan: ClinicalTrials preview parity

- Goal: Make ClinicalTrials.gov search closer to the PubMed preview by returning and rendering trial triage metadata.
- Constraints: Keep the workflow public/read-only; do not persist live trial search results yet.
- Done condition: The ClinicalTrials integration parses trial design, enrollment, conditions, interventions, outcomes, and result signals; tests cover parsing/fallbacks/page-size bounds; the dashboard shows a compact live preview.
- Files likely touched: `src/lib/integrations/clinical-trials.ts`, `src/lib/integrations/clinical-trials.test.ts`, `src/app/api/trials/search/route.ts`, `src/components/evidence-dashboard.tsx`, docs.
- Steps:
  - Extend the API adapter with fallback-safe fields and simple review cues.
  - Add `pageSize` passthrough with a conservative cap.
  - Add a compact ClinicalTrials preview inside the existing Sources and Review Queue panel.
  - Validate tests, lint, typecheck, build, and smoke check.
- Risks: ClinicalTrials records vary widely; UI must handle missing values and avoid implying registry records prove efficacy.

## Result

- Status: Completed ClinicalTrials preview parity slice.
- Extended the ClinicalTrials.gov adapter with fallback-safe parsing for study type, enrollment, conditions, interventions, primary outcomes, dates, result-posting signals, sponsor, bounded `pageSize`, and conservative triage cues.
- Added a compact live ClinicalTrials.gov preview in the Sources and Review Queue panel while keeping the curated Trial Watcher separate.
- Added focused mocked tests for parsing, fallback behavior, and page-size bounds.
- Kept the workflow public/read-only; live search results are not persisted to PostgreSQL yet.
- Validation run: `npm run test -- src/lib/integrations/clinical-trials.test.ts`, `npm run test`, `npm run db:validate`, `npm run lint`, `npm audit`, `npm run typecheck`, and `npm run build`.
