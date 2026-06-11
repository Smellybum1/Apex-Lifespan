# Candidate External Id Filter

- Goal: make duplicate source-candidate identities easier to inspect by filtering the read-only review queue by source external id.
- Constraints: keep it read-only; do not change review decisions, ingestion writes, public routes, or curation handoff semantics.
- Done condition: `--candidates --candidate-external-id <id>` filters by source external id, list rows show `externalId=...`, tests cover parser/data/formatter behavior, and docs describe the operator use.
- Files likely touched: `src/lib/data/source-candidates.ts`, `src/lib/data/source-candidates.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Validation: focused source-candidate data and command tests, real CLI smoke for PMID 42141930, full relevant checks before commit.
- Risks: the new flag must not be accepted on write modes or silently ignored on curation handoff.

## Result

- Added `--candidate-external-id <id>` for the read-only source-candidate review queue.
- Review queue rows now print `externalId=...`, and accept/reject confirmations include the source external id.
- Verified the filter against local PMID `42141930`, which returned the unscoped and claim-scoped pending PubMed candidates for the same source identity.
- Validation: focused source-candidate data and command tests, real `--candidate-external-id` and `--help` smokes, full tests, lint, `dev:stop`, typecheck, build, and `git diff --check`.
