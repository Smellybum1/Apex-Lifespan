# Source Candidate Job Status Filter

- Goal: add a read-only `--jobs-status <status>` filter so operators can list queued, running, succeeded, failed, or skipped source-candidate ingestion jobs after seeing status counts in `--summary`.
- Constraints: keep `--jobs` read-only; do not run ingestion or mutate candidate/review/curation state; keep status aliases explicit and bounded to ingestion job statuses.
- Done condition: `npm run ingest:sources -- --jobs --jobs-status queued` lists only queued supported source-candidate ingestion jobs.
- Files likely touched: `src/lib/data/source-candidate-jobs.ts`, `src/lib/data/source-candidate-jobs.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Steps: add optional status filter in the job list helper; parse and validate `--jobs-status`; document output and examples; validate with focused tests, jobs smoke, full tests, lint, typecheck, and build.
- Risks: status filter should not combine with run or write modes, and output wording must remain operational rather than evidence-quality framing.

## Result

- Added `--jobs-status <status>` as a read-only filter for recent source-candidate ingestion jobs, with queued/running/succeeded/failed/skipped aliases.
- Documented queued and failed job-list examples and refreshed handoff next actions.
- Validation passed: focused source-candidate job tests, command tests, help smoke, queued jobs smoke, full tests, lint, typecheck, build, and `git diff --check`.
