# Candidate Review Packet

- Goal: make one-candidate human review easier by bundling candidate detail, accepted-reference matches, and sibling context in one read-only operator command.
- Constraints: keep it read-only; do not write review decisions, references, claim links, study extraction, ingestion rows, or public route data.
- Done condition: `--candidate-review-packet <dedupe-key>` accepts raw or `b64:` keys, prints detail plus reference-match and sibling sections, is isolated from write/run modes, and is documented.
- Files likely touched: `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Validation: focused command tests, local CLI smoke with an existing candidate safe key, full tests/lint/typecheck/build.
- Risks: packet wording must not imply evidence quality or review completion.

## Result

- Added `--candidate-review-packet <dedupe-key>` as a read-only operator command that accepts raw or `b64:` source-candidate keys and prints candidate detail, accepted-reference matches, and sibling context together.
- Isolated the packet mode from write, queue, run, list, sibling, detail, curation, and extraction modes.
- Documented the command in the source-candidate workflow and handoff notes.
- Validated with CLI smoke, focused command tests, full tests, lint, typecheck, and build.
