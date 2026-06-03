# Source Candidate Job Queue Command

## Goal

Let a local operator queue PubMed or ClinicalTrials.gov source-candidate ingestion jobs without manually editing PostgreSQL.

## Constraints

- Keep this private/local; no public write routes or UI admin controls.
- Queueing should be conservative: create missing jobs and report existing jobs without silently resetting completed work.
- Support Australia-first defaults with optional region, intervention id, and claim id metadata.
- Keep unsupported sources out of the source-candidate queue command.

## Done Condition

- Backend helper can create or return an existing supported source-candidate ingestion job.
- `npm run ingest:sources -- --queue-pubmed "<term>"` creates/reports a PubMed job.
- `npm run ingest:sources -- --queue-clinical-trials "<term>"` creates/reports a ClinicalTrials.gov job.
- Tests cover source parsing, metadata, existing job behavior, and command output.
- README and project memory document queue usage and operator-only boundary.

## Files Likely Touched

- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps

1. Add queue helper and result mapping.
2. Add command parser flags and output formatting.
3. Extend mocked Prisma and command tests.
4. Update docs and run validation.

## Validation

- `npm run test -- src/lib/data/source-candidate-jobs.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Queue terms can become noisy; normalize whitespace and bound term length before storing.
- Existing jobs should not be reset implicitly, or an operator could rerun reviewed ingestion accidentally.
