# Source Candidate Reference Traceability

## Goal

Tighten accepted source-candidate review so the curated reference link must visibly match the candidate source and external identifier, not merely exist as any reference id.

## Constraints

- Keep public routes and UI unchanged.
- Do not infer scientific relevance or promote evidence cards.
- Keep rejection behavior unchanged.
- Keep the pending-only review guard.
- Use existing `Reference.source`, `Reference.identifier`, and `Reference.url` fields.

## Done Condition

- Accepted PubMed candidates require a PubMed curated reference whose identifier or PubMed URL has an exact parsed PMID match, or whose URL exactly matches after normalisation.
- Accepted ClinicalTrials.gov candidates require a ClinicalTrials.gov curated reference whose identifier or URL has an exact parsed NCT id match, or whose URL exactly matches after normalisation.
- Wrong source, wrong identifier, missing reference, and missing pending candidate paths fail with clear errors.
- README and project memory document the traceability guard.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Overly strict matching can block legitimate curated references with unusual identifiers; allow exact URL match plus exact parsed identifier/URL tokens to avoid brittle title matching.
