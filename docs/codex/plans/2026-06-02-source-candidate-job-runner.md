# Source Candidate Job Runner

## Goal

Bridge queued `IngestionJob` records to the existing PubMed and ClinicalTrials.gov source-candidate ingestion helpers without adding public write routes.

## Constraints

- Public MVP stays read-only.
- PubMed remains the first ingestion priority; ClinicalTrials.gov support can share the same runner.
- Unsupported sources should be skipped safely rather than guessed.
- Job status, counts, and errors should be persisted for operator visibility.

## Done Condition

- A backend helper can run one queued supported source-candidate job.
- A backend helper can run a specific job by id.
- Supported jobs transition through running to succeeded/failed with timestamps and counts.
- Unsupported source-candidate jobs are marked skipped with a clear reason.
- Tests cover success, no queued job, unsupported source, and failure handling.

## Files Likely Touched

- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `docs/codex/project.md`

## Steps

1. Add job lookup and status update helpers.
2. Route PubMed and ClinicalTrials.gov jobs to existing ingestion helpers.
3. Read optional `interventionId` and `claimId` from job metadata.
4. Add mocked Prisma and ingestion-helper tests.
5. Run targeted and broad validation.

## Validation

- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Job counts can be interpreted too strongly; they should remain ingestion-operation counts, not evidence-quality signals.
- Future scripts must still avoid exposing this as a public write route without auth.
