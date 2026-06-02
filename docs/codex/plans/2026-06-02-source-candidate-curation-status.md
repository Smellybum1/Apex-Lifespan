# Source Candidate Curation Status

## Goal
Add a read-only local handoff check that shows whether an accepted source candidate has reached curated public evidence surfaces.

## Constraints
- Keep promotion manual; do not create references, claim links, studies, or public routes.
- Reuse source-candidate framing and avoid calling accepted candidates curated evidence.
- Keep output compact and terminal-safe.
- Preserve public live-source API read-only boundary.

## Done Condition
- `npm run ingest:sources -- --candidate-curation-status <dedupe-key>` reports candidate decision, accepted reference, claim-link status, study extraction status, and a curation status label.
- Missing candidates fail clearly.
- Pending/rejected candidates report that they are not accepted instead of querying downstream curation tables.
- Tests cover ready, extraction-pending, claim-link-missing, missing-reference/not-accepted, parser isolation, and output formatting.
- README and project memory document the handoff check.

## Files Likely Touched
- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps
1. Add a backend helper that reads one source candidate and, if accepted, checks its accepted reference, claim links, and studies.
2. Add CLI parsing, validation, usage, runner injection, and formatting for the read-only status mode.
3. Add targeted tests for status variants and command isolation.
4. Update docs and run targeted plus broad validation.

## Validation
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Output must not imply source-candidate acceptance automatically promotes evidence cards.
- Public visibility should be tied to claim-link plus structured study extraction, consistent with source-packet behavior.
