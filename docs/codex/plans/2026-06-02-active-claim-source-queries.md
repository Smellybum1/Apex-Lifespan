# Plan: Active claim source queries

- Goal: Make live PubMed and ClinicalTrials previews easier to use from the selected evidence claim.
- Constraints: Keep the workflow public/read-only; suggested queries should not imply that live source candidates are reviewed evidence.
- Done condition: Active claim/intervention generate deterministic PubMed and ClinicalTrials search terms, tests cover the helper, and the Sources panel exposes one-click search presets.
- Files likely touched: `src/lib/source-queries.ts`, tests, `src/components/evidence-dashboard.tsx`, docs.
- Steps:
  - Add a pure helper that converts an intervention and claim outcome into source search terms.
  - Add focused tests for common outcomes and fallback behavior.
  - Pass active claim/intervention into the Sources panel.
  - Add compact controls to apply the active claim query to PubMed, ClinicalTrials, or both.
  - Validate tests, lint, typecheck, build, and smoke check.
- Risks: Avoid auto-refetching on every claim selection; make query application user-driven.

## Result

- Status: Completed active-claim source query slice.
- Added a pure helper that builds PubMed and ClinicalTrials search terms from the selected intervention and claim outcome.
- Added focused tests for strength, cardiovascular, and fallback query generation.
- Passed active claim/intervention into the Sources and Review Queue panel.
- Added compact suggested-search controls that apply active claim terms to PubMed, ClinicalTrials, or both without auto-refetching on selection changes.
- Validation run: `npm run test -- src/lib/source-queries.test.ts`, `npm run test`, `npm run db:validate`, `npm run lint`, `npm audit`, `npm run typecheck`, and `npm run build`.
