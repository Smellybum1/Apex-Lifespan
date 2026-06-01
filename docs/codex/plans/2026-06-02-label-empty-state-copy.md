# Label Empty State Copy

- Goal: Make the Product Label Analyzer empty state avoid implying safety, efficacy, or Australia/TGA clearance.
- Constraints: Keep the copy consumer-friendly and short; preserve the public read-only MVP boundary.
- Done condition: The empty state says no local rule warnings were found and reminds users that AUST/ARTG status and citations still need verification.
- Files likely touched: `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Update the empty-state sentence in the Label Analyzer.
  - Run lint and a browser check that shows the copy after clearing the label textarea.
- Risks: Overly alarmist copy would make a neutral empty state feel like a warning; keep it factual.
