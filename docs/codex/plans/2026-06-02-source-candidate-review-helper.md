# Source Candidate Review Helper

## Goal

Add backend-only helpers for reviewing persisted PubMed and ClinicalTrials.gov source candidates: list pending candidates for review and record accept/reject decisions.

## Constraints

- Keep public preview routes read-only and unpersisted.
- Do not promote candidates into curated references or studies automatically.
- Require a curated `acceptedReferenceId` before marking a candidate accepted.
- Preserve Australia-first, PubMed-first MVP direction.

## Done Condition

- Data helper can list pending candidates in a bounded review queue.
- Data helper can record accepted or rejected human review decisions.
- Tests cover queue defaults, limit bounds, accepted decisions, rejected decisions, and accepted-without-reference rejection.
- Project memory notes the new review helper.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `docs/codex/project.md`

## Steps

1. Add DB-to-domain mapping helpers for source candidates.
2. Add bounded review queue listing.
3. Add decision recording with accepted-reference guard.
4. Extend mocked Prisma tests.
5. Run targeted and broad validation.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Prisma JSON and enum mapping can drift from domain types.
- A future route could accidentally expose persistence; this slice keeps new helpers unreferenced by `src/app`.
