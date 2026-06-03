# Investor Evidence Details

## Goal

Make the existing evidence cards match the project preference: consumer-friendly by default, with investor-grade research detail available on demand.

## Constraints

- Keep the public read-only MVP posture.
- Keep peptide and regulatory guardrails intact.
- Avoid adding persistence or admin workflow in this slice.
- Preserve the current active-card selection behavior.

## Done Condition

- Evidence cards are no longer one large interactive button that blocks nested detail controls.
- Each card shows a compact consumer summary by default.
- Each card has an expandable research detail section with study context, effect/applicability notes, score-change rationale, and direct reference links.
- Project memory records the new UI pattern.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Steps

1. Refactor `EvidenceCards` from button cards into article cards with a select button.
2. Add an expandable research detail area and source links.
3. Update project memory.
4. Validate with lint, typecheck/build as appropriate, and a local smoke check.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- HTTP smoke test local app

## Risks

- Nested interactive controls could hurt accessibility if the card remains a button.
- Long source titles can overflow compact cards if not wrapped.

## Result

- Refactored evidence cards from full-card buttons into article cards with focused title-select buttons.
- Added expandable research detail with evidence grade, effect, population, comparator, duration, applicability, score mover, review date, and source links.
- Confirmed the disclosure with a Playwright snapshot and screenshot.
- Validation passed: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and local HTTP smoke.
