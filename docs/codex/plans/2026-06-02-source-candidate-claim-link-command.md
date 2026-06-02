# Source Candidate Claim Link Command

## Goal

Add a guarded local operator write command that links an accepted source candidate's matching curated reference to its claim.

## Constraints

- Keep public routes and dashboard behavior unchanged.
- Write only a `ClaimReference` row; do not create references, studies, or public evidence promotions.
- Require the candidate to be accepted, claim-scoped, and linked to a matching accepted reference.
- Validate the candidate claim exists and belongs to the candidate intervention when intervention context is present.
- Keep curation wording about source-packet readiness, not evidence quality.

## Done Condition

- `npm run ingest:sources -- --link-candidate-claim <dedupe-key>` creates or updates the accepted reference claim link.
- Optional relevance and note flags are bounded and documented.
- Command output reports created/updated state plus resulting curation readiness.
- Data helper and command tests cover success, guard failures, parsing, formatting, and mode conflicts.
- Workflow docs and project memory document the local write boundary.

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

- A claim link can make a source packet closer to public readiness; command output must still show extraction status and avoid auto-promotion.
- Stale candidate context could link the wrong claim unless claim/reference checks are strict.

## Result

- Added `--link-candidate-claim <dedupe-key>` with optional `--claim-link-note` and bounded `--claim-link-relevance`.
- Added a guarded data helper that validates accepted decision, accepted-reference match, claim presence, and intervention/claim consistency before upserting only `ClaimReference`.
- Validation passed: focused source-candidate data tests, focused command tests, command help smoke, full tests, lint, typecheck, and build.
