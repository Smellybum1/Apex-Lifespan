# Claim Table Source Packet Column

## Goal

Add source-packet completeness to the claim score table so readers can scan citation/extraction readiness across intervention-outcome rows.

## Constraints

- Keep the public app read-only.
- Reuse the tested source-packet completeness rules and tone.
- Keep the table dense and scannable.
- Do not mix live PubMed or ClinicalTrials.gov preview status into curated source-packet status.

## Done Condition

- Claim score rows include a compact `Sources` column.
- The column shows the source-packet completeness label with the same tone as other source-packet surfaces.
- Project memory records table-level packet status visibility.
- Browser smoke confirms the table column renders without obvious layout issues.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Validation

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Local HTTP smoke and Playwright snapshot/screenshot of the claim table.

## Risks

- The table can become too wide; keep the cell text short and preserve horizontal scrolling.
- The source-packet label should not be read as evidence quality.
