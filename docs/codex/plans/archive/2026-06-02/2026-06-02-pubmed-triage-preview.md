# Plan: PubMed triage preview

- Goal: Make the public dashboard show a useful read-only PubMed citation preview instead of only linking to raw API JSON.
- Constraints: Keep it public/read-only, citation-focused, and conservative; do not write PubMed results to the database yet.
- Done condition: PubMed integration returns triage metadata, the dashboard can search and render citation cards, and tests cover the added parsing/triage behavior.
- Files likely touched: `src/lib/integrations/pubmed.ts`, `src/lib/integrations/pubmed.test.ts`, `src/components/evidence-dashboard.tsx`, docs.
- Steps:
  - Extend PubMed summaries with DOI, publication types, abstract availability, and simple relevance cues.
  - Add a compact citation triage panel to the Sources area.
  - Keep raw API links available for direct inspection.
  - Validate tests, lint, typecheck, build, and smoke check.
- Risks: Live PubMed fetch behavior can vary; tests should mock response shapes and the UI should degrade gracefully.

## Result

- Status: Completed PubMed triage preview slice.
- Extended PubMed summaries with publication types, DOI, abstract availability, bounded `retmax`, and conservative relevance cues.
- Added an in-page PubMed triage panel in the Sources and Review Queue area with search, raw API access, citation cards, metadata, and PMID links.
- Kept the workflow read-only; no PubMed results are persisted to PostgreSQL yet.
- Validation run: `npm run test`, `npm run db:validate`, `npm run lint`, `npm audit`, `npm run typecheck`, and `npm run build`.
