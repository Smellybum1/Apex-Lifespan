# Plan: Regression safety

- Goal: Add a lightweight test runner and first tests around scoring and label safety guardrails.
- Constraints: Keep tests fast and focused; avoid browser or database requirements.
- Done condition: `npm run test` exists and passes with coverage of composite scoring, score bands, hype/peptide detection, and negated proprietary-blend text.
- Files likely touched: `package.json`, `vitest.config.ts`, `src/lib/scoring.test.ts`, docs command references.
- Steps:
  - Install Vitest.
  - Configure path aliases for local tests.
  - Add focused scoring and label analyzer tests.
  - Update project command docs.
- Validation: `npm run test`, then broader validation before commit.
- Risks: Path alias behavior on Windows.

## Result

- Status: Completed initial test safety net.
- Validation run: `npm run test`.
