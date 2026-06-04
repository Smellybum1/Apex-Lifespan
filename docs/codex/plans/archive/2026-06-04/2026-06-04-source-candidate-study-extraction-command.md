# Source Candidate Study Extraction Command

- Goal: add a guarded local operator command that creates or updates structured `Study` extraction for an accepted source candidate's accepted reference.
- Constraints: keep public routes read-only; do not create references, claim links, source documents, source-candidate decisions, or public promotions; require accepted candidate, matching accepted reference, claim context, and existing claim link.
- Done condition: `npm run ingest:sources -- --extract-candidate-study <dedupe-key> ...` writes only a `Study` row after explicit operator-supplied extraction fields and reports resulting curation readiness.
- Files likely touched: `src/lib/data/source-candidates.ts`, `src/lib/data/source-candidates.test.ts`, `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/project.md`, `docs/codex/handoff.md`.
- Steps: add data helper and guards; add isolated CLI mode and parser validation; document command boundary; validate with focused and broad checks.
- Validation: focused data and command tests, command help smoke, DB summary smoke, full tests, lint, typecheck, build.
- Risks: study extraction can make a source packet ready, so command wording and guards must keep this local/operator-only and avoid auto-review or evidence-quality claims.

## Result

- Added `--extract-candidate-study` as a guarded local write that creates or explicitly updates only a `Study` row after accepted-candidate, matching-reference, claim-context, and claim-link checks.
- Documented the command boundary and refreshed handoff state after local Docker/PostgreSQL migration and seed verification.
- Validation passed: focused source-candidate tests, command tests, help and summary smokes, full tests, lint, typecheck, build, and `git diff --check`.
