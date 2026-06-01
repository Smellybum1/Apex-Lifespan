# Live Source Request Bounds

- Goal: Bound public PubMed and ClinicalTrials.gov API search requests before they hit external source wrappers.
- Constraints: Keep the MVP public read-only, preserve existing integration-level result caps, and avoid changing the dashboard UI flow.
- Done condition: Both live-source API routes reject missing or overlong terms, normalise accepted terms, and have route-level tests proving they do not call external integrations for invalid input.
- Files likely touched: `src/app/api/pubmed/search/route.ts`, `src/app/api/trials/search/route.ts`, `src/lib/live-source-request.ts`, route tests, `docs/codex/project.md`.
- Steps:
  - Add a small shared request parser for live-source search routes.
  - Use it from PubMed and ClinicalTrials.gov API routes.
  - Add tests for accepted, missing, and overlong terms.
  - Run targeted route tests, lint, and a final diff review.
- Risks: Keep validation copy clear without making normal active-card queries fail.
