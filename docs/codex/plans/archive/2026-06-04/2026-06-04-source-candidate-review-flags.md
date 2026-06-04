# Source Candidate Review Flags

## Goal

Surface local-only, read-only review flags for source-candidate rows when a claim-scoped candidate may need extra off-claim scrutiny.

## Scope

- Add computed CLI display flags only; do not change candidate persistence, triage scoring, ranking, public routes, or promotion logic.
- Cover broad safety/adverse query context and very low title/query overlap.
- Update focused command tests and operator workflow docs.

## Validation

- Run the focused source-candidate command tests first.
- Smoke a read-only candidate packet/list if local data is reachable.
- Run broader project checks before committing.

## Result

- Added display-only `reviewFlags`/`topReviewFlags` and detail `reviewCautions`.
- Kept scoring, persistence, ranking, public routes, and promotion logic unchanged.
- Validated with focused tests, read-only local smokes, full tests, lint, and typecheck.
