# Source Packet Completeness

- Goal: Make active-card source packets show whether curated references are fully extracted, still pending extraction, missing source records, or not linked yet.
- Constraints: Keep live PubMed/ClinicalTrials previews separate from curated source status; avoid implying automated live results are reviewed evidence.
- Done condition: Source packet helper returns a tested completeness summary and the Sources panel exposes that summary at a glance.
- Files likely touched: `src/lib/source-packet.ts`, `src/lib/source-packet.test.ts`, `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Add a packet completeness summary to the source-packet helper.
  - Cover complete, pending, missing, and unlinked states in tests.
  - Surface the summary and counts in the active source packet panel.
  - Validate with tests, lint, typecheck, build, and browser smoke/UI check.
- Risks: Keep "extracted" tied to curated study records only, not live API previews.
