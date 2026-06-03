# Evidence Card Source Packet Badges

## Goal

Show each evidence card's curated source-packet completeness state directly on the card so readers can see citation/extraction readiness before selecting the card.

## Constraints

- Keep the public app read-only.
- Use existing source-packet completeness rules.
- Keep live PubMed and ClinicalTrials.gov previews separate from curated packet status.
- Keep card copy compact and consumer-friendly.

## Done Condition

- Evidence cards display a source-packet completeness badge.
- The badge uses the same tone and status label as the active-card source packet.
- Project memory records card-level packet status visibility.
- Browser smoke confirms the badge renders without obvious overlap.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Validation

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Local HTTP smoke and Playwright snapshot/screenshot of evidence cards.

## Risks

- Card badges could be mistaken for evidence quality; label them as source-packet status.
- Extra badges should not make compact cards visually noisy.
