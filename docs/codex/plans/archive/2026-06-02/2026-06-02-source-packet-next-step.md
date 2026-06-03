# Source Packet Next Step

## Goal

Make the active-card source packet explain the next source-coverage step for each completeness state so public readers can distinguish complete extraction from pending, missing, or unlinked curation work.

## Constraints

- Keep the public app read-only.
- Keep live PubMed and ClinicalTrials.gov previews separate from curated source packet status.
- Use consumer-friendly wording and avoid implying medical certainty or automated evidence approval.
- Preserve existing completeness statuses and counts.

## Done Condition

- `ClaimSourcePacketCompleteness` includes a tested `nextStep` string for complete, extraction-pending, missing-source, and unlinked states.
- The active source packet panel displays the next source step near the coverage summary.
- Project memory records the public source-packet next-step behavior.

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
- Local HTTP smoke and a browser screenshot check of the active source packet.

## Risks

- Wording could sound like public evidence approval rather than source traceability status.
- The UI line should not crowd the source packet card on mobile.
