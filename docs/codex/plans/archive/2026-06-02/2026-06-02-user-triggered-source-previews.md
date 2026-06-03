# User-Triggered Source Previews

## Goal

Align live PubMed and ClinicalTrials.gov previews with the project rule that active-claim source searches are user-triggered and do not refetch on every evidence-card selection.

## Constraints

- Keep curated active-card source packets visible without network fetches.
- Do not auto-run live PubMed or ClinicalTrials.gov searches on initial page load.
- Keep suggested active-claim search buttons as explicit user actions.
- Preserve public read-only behavior.

## Done Condition

- Live preview panels start idle with clear empty-state copy.
- PubMed and ClinicalTrials.gov API calls only run after submitting a form or clicking a suggested-search action.
- Selecting a different evidence card updates suggested terms and curated source packet, but does not refetch live previews.
- Raw API links remain explicit user actions and reflect the submitted query when present.
- Project memory records the stricter user-triggered behavior.

## Files Likely Touched

- `src/components/evidence-dashboard.tsx`
- `docs/codex/project.md`

## Steps

1. Add an idle status to the live preview state model.
2. Make submitted terms nullable and guard fetch effects until a term is submitted.
3. Route form submits and suggested-search buttons through explicit submit helpers.
4. Update preview empty states and raw-link behavior.
5. Validate and browser-smoke the no-initial-fetch behavior.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- HTTP and Playwright smoke

## Risks

- Users need obvious prompts for how to run the first live search.
- A prior live preview can intentionally remain visible after selecting a new card; the query label must make that clear.

## Result

- Live PubMed and ClinicalTrials.gov previews now start in an idle state.
- Submitted live searches are explicit user actions from forms, suggested-source buttons, or raw links.
- Re-clicking the same suggested term can retry because submitted searches carry a request id.
- Browser smoke confirmed no PubMed/Trials API calls on initial page load, one PubMed call after clicking the PubMed suggestion, and no refetch when selecting another evidence card.
- Validation passed: `npm run lint`, `npm run test`, `npm run typecheck`, `npm run build`, and local HTTP/browser smoke.
