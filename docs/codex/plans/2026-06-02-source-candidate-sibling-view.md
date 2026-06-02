# Source Candidate Sibling View

## Goal

Add a read-only local operator view that shows same-identity source-candidate siblings for a target candidate so curation can spot duplicate rediscovery, accepted/rejected history, and context-specific claim/intervention variants before review.

## Constraints

- Keep public routes and dashboard behavior unchanged.
- Read-only command mode only; do not mutate candidate decisions, references, claims, or jobs.
- Preserve source-candidate wording as curation/readiness support, not evidence quality.
- Keep results bounded and deterministic.

## Done Condition

- `npm run ingest:sources -- --candidate-siblings <dedupe-key>` prints the target candidate plus same-source/external-id sibling rows.
- The sibling helper can optionally include same-query context siblings while still bounding output.
- Parser, runner, formatting, missing-target, and mode-conflict behavior are covered by tests.
- `docs/codex/source-candidate-workflow.md`, `docs/codex/project.md`, and this handoff plan describe the new read-only view.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `docs/codex/source-candidate-workflow.md`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Same-query matches could be too broad; output should label match reasons and keep the target row distinct.
- Review decisions must remain human-controlled and operator-only.

## Result

- Added `--candidate-siblings <dedupe-key>` and `--candidate-siblings-limit <count>`.
- Added a read-only data helper that finds same-source/external-id siblings and exact same-query/context siblings, then labels match reasons.
- Validation passed: focused source-candidate data tests, focused command tests, command help smoke, full tests, lint, typecheck, and build.
