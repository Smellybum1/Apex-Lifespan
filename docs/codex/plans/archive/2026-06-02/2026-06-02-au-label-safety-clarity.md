# Plan: AU label safety clarity

- Goal: Make the product label analyzer explain Australia/TGA-specific risks when labels mention peptides, imported vials, therapeutic claims, or AUST status.
- Constraints: Keep the workflow public read-only; do not provide sourcing, preparation, dosing, injection, cycling, or self-administration guidance.
- Done condition: Label analysis has AU/TGA-specific findings, tests cover the triggers, and the UI shows source links/details without overwhelming the analyzer.
- Files likely touched: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `src/components/evidence-dashboard.tsx`, docs.
- Steps:
  - Add optional source URL/detail fields to label findings.
  - Add AUST-number detection and missing-AUST caution for therapeutic labels.
  - Add stronger peptide/import/vial caution language grounded in TGA safety alerts.
  - Surface source links in the analyzer cards.
  - Validate tests, lint, typecheck, build, and smoke check.
- Risks: Avoid implying every non-AUST supplement is illegal; phrase missing-AUST findings as a verification prompt tied to therapeutic product claims.

## Result

- Status: Completed AU label safety clarity slice.
- Added AU/TGA-specific label findings for unresolved AUST status, no visible AUST number on therapeutic-style claims, TGA approval overclaims, and research-use/injectable peptide language.
- Added source links to label finding cards so consumer-facing cautions can point to TGA AUST-number guidance and peptide safety warnings.
- Kept peptide findings public/read-only and explicitly outside sourcing, preparation, dosing, injection, cycling, or self-administration guidance.
- Validation run: `npm run test -- src/lib/scoring.test.ts`, plus full checks before commit.
