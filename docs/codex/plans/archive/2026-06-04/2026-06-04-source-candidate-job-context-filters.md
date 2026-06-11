# Source Candidate Job Context Filters

- Goal: add read-only `--jobs-*` filters so operators can narrow recent source-candidate ingestion jobs by source, region, intervention, and claim after using `--summary` or `--jobs-status`.
- Constraints: keep `--jobs` read-only; do not run ingestion or mutate candidate/review/curation state; keep filters separate from queue metadata and candidate filters.
- Done condition: `npm run ingest:sources -- --jobs --jobs-status queued --jobs-claim-id <claim-id>` lists only matching supported source-candidate ingestion jobs.
- Files likely touched: `src/lib/data/source-candidate-jobs.ts`, `src/lib/data/source-candidate-jobs.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Steps: add optional list filters; parse and validate `--jobs-source`, `--jobs-region`, `--jobs-intervention-id`, and `--jobs-claim-id`; document examples; validate with focused tests, command smoke, full tests, lint, typecheck, and build.
- Risks: filters should not retarget jobs, imply evidence quality, or conflict with queue/run/write modes.

## Result

- Added read-only job-list filters for source, region, intervention id, and claim id.
- Documented combined queued/claim and source/region job-list examples for operator handoff.
- Validation passed: focused source-candidate job tests, command tests, help smoke, claim-filtered jobs smoke, source/region jobs smoke, full tests, lint, typecheck, build, and `git diff --check`.
