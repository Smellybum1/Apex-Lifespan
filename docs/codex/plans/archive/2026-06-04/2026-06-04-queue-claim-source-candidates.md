# Queue Claim Source Candidates

- Goal: add a local operator command that queues PubMed and ClinicalTrials.gov source-candidate ingestion jobs for a claim using the existing active-claim source query builder.
- Constraints: keep public routes read-only; do not run jobs automatically; validate claim and intervention context through Prisma; preserve existing queue identity and no-reset behavior for completed jobs.
- Done condition: `npm run ingest:sources -- --queue-claim-sources <claim-id>` queues or reports the claim-scoped PubMed and ClinicalTrials.gov jobs with generated query text and job ids.
- Files likely touched: `src/lib/data/source-candidate-jobs.ts`, `src/lib/data/source-candidate-jobs.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Steps: add claim queue helper; add isolated CLI mode and conflict checks; document command and next action; validate with focused tests, help smoke, job-list smoke, full tests, lint, typecheck, and build.
- Risks: queueing should stay local/operator-only and must not imply source quality, run external ingestion automatically, or mutate review/curation state.

## Result

- Added `--queue-claim-sources <claim-id>` as a local operator queue mode that validates claim/intervention context, builds active-claim PubMed and ClinicalTrials.gov search terms, and queues or reports both claim-scoped jobs without running ingestion.
- Documented the command boundary and refreshed handoff state.
- Validation passed: focused source-candidate job tests, command tests, source-query tests, help smoke, real local queue smoke for `creatine-strength`, job-list smoke, full tests, lint, Prisma validate, typecheck, build, and `git diff --check`.
