# Source Candidate Job Claim Safety

## Goal

Make source-candidate ingestion job execution queued-only and race-resistant before more operator workflow is built on top.

## Constraints

- Keep the public app read-only; this stays in backend data helpers and local command behavior.
- Do not add a new schema field or migration.
- Preserve existing success, failure, skipped, and count semantics.
- Prevent accidental reruns of completed or running jobs.

## Done Condition

- Running a specific job requires the job to still be `QUEUED`.
- Claiming a queued job uses a status-guarded update before external ingestion starts.
- If a queued job is claimed by another process, the runner does not call external ingestion for that job.
- Tests cover successful claim, non-queued job rejection, claim race rejection, and next-job race handling.

## Files Likely Touched

- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `docs/codex/project.md`

## Steps

1. Replace the unconditional running update with a guarded claim update.
2. Keep `runNextSourceCandidateIngestionJob` resilient when a selected job cannot be claimed.
3. Update tests for claim/update call order and race cases.
4. Run targeted and broad validation.

## Validation

- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Local operators may see a clearer error for already-run jobs; this is intentional because reruns should be explicit future behavior.
