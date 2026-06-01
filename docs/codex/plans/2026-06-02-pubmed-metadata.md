# Plan: PubMed metadata response

- Goal: Make the PubMed search integration more useful for evidence ingestion by returning citation summary metadata with PMIDs.
- Constraints: Preserve existing API fields; use official NCBI E-utilities; keep the route resilient if summary metadata fails.
- Done condition: Search results include PMIDs, count, source, and article metadata with title/journal/date/year/authors/url when available.
- Files likely touched: `src/lib/integrations/pubmed.ts`, focused tests.
- Steps:
  - Fetch `esummary.fcgi` data for returned PMIDs.
  - Map missing fields safely.
  - Keep fallback article entries when summary fetch fails.
  - Add tests without live network dependency.
- Validation: `npm run test`, `npm run typecheck`, route smoke check.
- Risks: NCBI summary field shape may vary by article.

## Result

- Status: Completed.
- Validation run: `npm run test`; broader validation run before commit.
