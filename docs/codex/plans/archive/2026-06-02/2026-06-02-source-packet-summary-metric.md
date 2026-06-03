# Source Packet Summary Metric

## Goal

Add a top-level dashboard metric that summarizes claim source-packet completeness so readers can see whether scored claims are citation-linked and structurally extracted without selecting each card.

## Constraints

- Keep the public app read-only.
- Keep live PubMed and ClinicalTrials.gov previews separate from curated source packet status.
- Preserve active-card source packet details.
- Use consumer-friendly wording that describes source traceability, not evidence certainty.

## Done Condition

- A tested helper summarizes source-packet completeness across claims.
- The dashboard metric row shows complete claim packets and whether any claims need source work.
- Project memory records the aggregate source-packet summary behavior.

## Files Likely Touched

- `src/lib/source-packet.ts`
- `src/lib/source-packet.test.ts`
- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/source-packet.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Local HTTP smoke and a browser snapshot of the metric row.

## Risks

- Metric wording could imply all claim evidence is finalized; keep it scoped to source-packet traceability.
- The metric detail should remain readable when issue counts are non-zero.
