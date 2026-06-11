# Reference Draft For Empty Candidate Matches

- Goal: make pending source-candidate review smoother when no curated reference matches the candidate yet.
- Constraints: read-only CLI output only; do not create references, claim links, studies, review decisions, ingestion jobs, or public evidence rows.
- Done condition: empty `--candidate-reference-matches` output includes a clearly labeled manual reference draft with source, identifier, title, URL, optional year, and a stable suggested id; `--candidate-review-packet` inherits the same section.
- Files likely touched: `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Validation: focused command tests, CLI smoke on an existing zero-match candidate, full relevant checks before commit.
- Risks: draft wording must not imply the candidate is accepted, curated, or evidence-quality reviewed.

## Result

- Empty accepted-reference match output now includes a draft-only `referenceDraft=...` line with a stable suggested reference id, source, identifier, title, URL, and year when available.
- `--candidate-review-packet` inherits the same draft line because it reuses accepted-reference match formatting.
- The docs and handoff note that the draft line is manual curation support and does not write references or accept candidates.
- Validated with focused command tests, real CLI smokes for `--candidate-reference-matches` and `--candidate-review-packet`, full tests, lint, typecheck, and build.
