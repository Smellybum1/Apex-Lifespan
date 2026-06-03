# Source Candidate Curation Draft

## Goal

Add a read-only local operator view that turns one source candidate into a curation draft/checklist for claim-link and structured study extraction work.

## Constraints

- Keep public routes and dashboard behavior unchanged.
- Do not create references, claim links, studies, or decisions in this slice.
- Require accepted-reference state to stay visible; missing or mismatched accepted references should block draftable public-packet work.
- Preserve wording as curation/readiness support, not evidence quality or medical advice.

## Done Condition

- `npm run ingest:sources -- --candidate-curation-draft <dedupe-key>` prints candidate status plus draftable claim-link and study-extraction fields when appropriate.
- Non-accepted, missing-reference, and mismatch states report blockers without suggesting public promotion.
- Parser, runner, formatting, missing-target, and mode-conflict behavior are covered by tests.
- `docs/codex/source-candidate-workflow.md`, `docs/codex/project.md`, and `docs/codex/handoff.md` document the new read-only view.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `docs/codex/source-candidate-workflow.md`
- `docs/codex/project.md`
- `docs/codex/handoff.md`

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Draft output could be mistaken for an automatic promotion path; keep it read-only and explicitly show blockers.
- Candidate metadata can be incomplete, so manual extraction fields must remain explicit.

## Result

- Added `--candidate-curation-draft <dedupe-key>`.
- Added a read-only curation draft helper that reuses accepted-reference readiness rules and prints claim-link/study-extraction draft fields only when the accepted reference is usable.
- Validation passed: focused source-candidate data tests, focused command tests, command help smoke, full tests, lint, typecheck, and build.
