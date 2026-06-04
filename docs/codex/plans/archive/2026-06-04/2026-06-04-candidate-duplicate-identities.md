# Candidate Duplicate Identities

- Goal: surface duplicate source-candidate identities, such as the same PMID or NCT id across query/claim scopes, without requiring the operator to know the external id first.
- Constraints: keep the view read-only; do not write review decisions, ingestion rows, references, claim links, studies, or public routes.
- Done condition: `--candidates --candidate-duplicates` prints duplicate source/external-id groups with safe candidate keys and context rows, and respects existing candidate filters.
- Files likely touched: `src/lib/data/source-candidates.ts`, `src/lib/data/source-candidates.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Validation: focused data/command tests, local CLI smoke showing the PMID `42141930` duplicate group, full tests/lint/typecheck/build.
- Risks: the duplicate scan must stay bounded and must not imply evidence quality or review outcomes.

## Result

- Added `--candidates --candidate-duplicates` for a read-only duplicate PMID/NCT source-identity scan.
- Duplicate groups respect existing candidate filters and print per-candidate safe keys, query, decision, review status, ingestion job, and optional intervention/claim context.
- Verified locally with PubMed PMID `42141930`, which surfaced the claim-scoped and unscoped pending candidates for the same source identity.
- Validation: focused data and command tests, real duplicate-scan and help smokes, full tests, lint, `dev:stop`, typecheck, build, and `git diff --check`.
