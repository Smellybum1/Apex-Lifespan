# Curated Source Extraction Backfill

- Goal: Backfill structured seed study/source extraction rows for existing linked curated references that still appear extraction-pending.
- Constraints: Use conservative summaries from official sources, keep Australia/TGA peptide guardrails, and avoid adding dosing, sourcing, or self-use guidance.
- Done condition: Current seed evidence claims with linked references show complete source packets, while synthetic tests still cover the extraction-pending state.
- Files likely touched: `src/lib/seed-data.ts`, `src/lib/source-packet.test.ts`, `docs/codex/project.md`.
- Steps:
  - Identify linked seed references without structured study rows.
  - Add structured rows for the NIH ODS omega-3 fact sheet and TGA safety-alert reference.
  - Update source-packet tests to assert current seed claims are complete and pending logic still works.
  - Run targeted tests, full tests, lint, and relevant build/type checks if needed.
- Risks: Overstating evidence quality; summaries must stay source-level and non-personalized.
