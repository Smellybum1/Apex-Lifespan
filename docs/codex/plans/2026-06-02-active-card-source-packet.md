# Active Card Source Packet

## Goal

Make the Sources and Review Queue panel visibly trace curated references and extracted studies to the currently selected evidence card.

## Constraints

- Keep live PubMed and ClinicalTrials previews separate from curated seed records.
- Do not auto-refetch live previews when the active card changes.
- Preserve public read-only behavior and Australia/TGA guardrails.
- Handle claims that have linked references but no extracted study record yet.

## Done Condition

- The source panel shows an active-card source packet with linked references and any extracted study records for the selected claim.
- References without extracted study records remain visible as extraction-pending items.
- The global curated study list no longer looks like the active card's source evidence.
- Source-packet matching logic has focused tests.
- Project memory records the traceability pattern.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `src/lib/source-packet.ts`
- `src/lib/source-packet.test.ts`
- `docs/codex/project.md`

## Steps

1. Add a helper to derive active claim references, matching studies, and missing reference IDs.
2. Use the helper in `SourceAndStudyPanel`.
3. Render the active packet separately from live previews and all curated records.
4. Update project memory and validate.

## Validation

- `npm run test -- src/lib/source-packet.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Local HTTP/browser smoke

## Risks

- Claims such as omega-3 currently have references without extracted study rows; the UI should make that explicit rather than hiding the reference.
- Long reference titles need wrapping in compact cards.

## Result

- Added a tested source-packet helper that links active claims to curated references, extracted studies, extraction-pending references, and missing reference IDs.
- Updated the Sources panel to show the active-card source packet ahead of live previews, with selected claim context and source-context labels.
- Moved non-active curated studies into a collapsed secondary section.
- Validation passed: focused source-packet tests, full tests, lint, typecheck, build, HTTP smoke, and Playwright snapshot/screenshot.
