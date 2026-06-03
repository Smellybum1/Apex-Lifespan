# Source Candidate Job Context

## Goal
Expose stored ingestion job intervention/claim context in local operator job output and warn when queueing finds an existing job with different requested context.

## Constraints
- Keep existing job uniqueness by source/query/region.
- Do not reset or mutate metadata on existing jobs.
- Keep this local/operator-only under `npm run ingest:sources`.
- Preserve public route read-only boundaries.

## Done Condition
- Job list items include stored `interventionId` and `claimId` when present.
- Queue output includes stored context for both new and existing jobs.
- Queue output reports context mismatch fields when requested context differs from existing stored metadata.
- Tests cover job listing context, new queued context, existing context match, and existing context mismatch.
- README and project memory document that queueing an existing job reports stored context without rewriting it.

## Files Likely Touched
- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps
1. Extend job list and queued job result types with stored context fields.
2. Add context mismatch detection for existing queue hits.
3. Format context/mismatch fields in local command output.
4. Update docs and run targeted plus broad validation.

## Validation
- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Existing jobs should not be implicitly retargeted to a new claim/intervention.
- Mismatch wording must be clear without implying failure or mutation.
