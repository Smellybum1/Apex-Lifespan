# Source Candidate Local Command

## Goal

Add a private local command for running source-candidate ingestion jobs through the backend-only job runner.

## Constraints

- Do not add public write routes or UI admin controls.
- Keep execution bounded by default.
- Support running the next queued jobs or a specific job id.
- Preserve PubMed-first defaults while allowing ClinicalTrials.gov job options.

## Done Condition

- `npm run ingest:sources` runs one queued supported source-candidate job by default.
- Operators can pass a job id, a batch limit, PubMed retmax, and ClinicalTrials.gov page size.
- Command output reports job ids, statuses, counts, and errors without implying evidence quality.
- Tests cover argument parsing and orchestration.
- Project memory and README document the private command.

## Files Likely Touched

- `scripts/run-source-candidate-jobs.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `package.json`
- `README.md`
- `docs/codex/project.md`

## Steps

1. Add testable command parser/orchestrator.
2. Add script entrypoint and package script.
3. Document command usage and public-read-only boundary.
4. Run targeted and broad validation.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Running against a live database/API can mutate local source-candidate tables; docs must keep this operator-only.
- CLI argument parsing should fail closed on invalid numbers or unknown options.
