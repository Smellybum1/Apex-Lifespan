# TGA Negation Regression

- Goal: Prevent negated TGA/ARTG approval phrases with curly apostrophes from being flagged as approval overclaims.
- Constraints: Keep the Australia/TGA overclaim guardrail strict for affirmative claims and avoid weakening peptide or AUST checks.
- Done condition: Label analysis treats `isn't`, `isn\u2019t`, `not yet`, `never`, and `no` approval phrases as negations, while affirmative approval claims still flag.
- Files likely touched: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `docs/codex/project.md`.
- Steps:
  - Add an ASCII-safe Unicode escape matcher alongside the legacy negation pattern.
  - Add focused tests for apostrophe and no-apostrophe negations.
  - Run targeted and broader validation.
- Risks: Over-broad negation matching could hide real overclaims; keep the pattern scoped to TGA/ARTG approval terms.
