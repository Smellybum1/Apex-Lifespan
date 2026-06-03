# PubMed Triage Copy

- Goal: Make live PubMed preview results clearly read as unreviewed citation leads rather than curated evidence or review status.
- Constraints: Keep live previews separate from curated source packets and do not rename API fields unless needed.
- Done condition: PubMed preview has an unreviewed-leads note and article score badges are labeled as triage scores.
- Files likely touched: `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Add a short note to the PubMed live preview panel.
  - Label PubMed article `/100` badges as triage scores.
  - Validate with lint and a browser check after running a PubMed suggestion.
- Risks: Copy should be concise and not imply live search results have been persisted or reviewed.
