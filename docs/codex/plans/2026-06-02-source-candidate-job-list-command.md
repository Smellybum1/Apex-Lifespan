# Source Candidate Job List Command

## Goal

Add read-only local visibility into recent source-candidate ingestion jobs so operators can discover job ids, statuses, counts, and errors without opening PostgreSQL.

## Constraints

- Keep public routes and UI unchanged.
- Read-only command mode only; do not claim, queue, reset, or run jobs.
- Keep output bounded by default and cap operator-supplied limits.
- Continue to treat counts as workflow counts, not evidence quality.

## Done Condition

- Data helper lists recent PubMed/ClinicalTrials.gov ingestion jobs with stable fields.
- `npm run ingest:sources -- --jobs` prints recent job ids and statuses.
- `--jobs-limit <count>` can bound output and is capped.
- Tests cover helper query/mapping, empty output, command output, and mode conflicts.
- README and project memory document the operator-only list mode.

## Files Likely Touched

- `src/lib/data/source-candidate-jobs.ts`
- `src/lib/data/source-candidate-jobs.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Validation

- `npm run test -- src/lib/data/source-candidate-jobs.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Output could encourage treating failed or changed counts as evidence signals; keep wording and docs operational.
