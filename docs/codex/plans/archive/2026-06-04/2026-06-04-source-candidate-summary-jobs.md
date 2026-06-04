# Source Candidate Summary Jobs

- Goal: make `npm run ingest:sources -- --summary` show source-candidate ingestion job status counts, so queued work is visible before candidate rows exist.
- Constraints: keep summary read-only; do not run jobs, ingest sources, or change review/curation state; preserve existing backlog and handoff wording.
- Done condition: summary output includes job totals grouped by source, region, and status, plus existing candidate backlog and curation handoff sections.
- Files likely touched: `src/lib/data/source-candidate-jobs.ts`, `src/lib/data/source-candidate-jobs.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Steps: add read-only job summary helper; wire CLI summary through injectable runner; format job status counts; document output; validate with focused tests, summary smoke, full tests, lint, typecheck, and build.
- Risks: summary wording must stay operational and not imply evidence quality; counting jobs must stay scoped to PubMed and ClinicalTrials.gov source-candidate ingestion jobs.

## Result

- Added read-only source-candidate ingestion job status counts to `--summary`, grouped by supported source, region, and status.
- Kept existing backlog and curation handoff summary sections unchanged after the new job section.
- Validation passed: focused source-candidate job tests, command tests, local summary smoke, full tests, lint, typecheck, build, and `git diff --check`.
