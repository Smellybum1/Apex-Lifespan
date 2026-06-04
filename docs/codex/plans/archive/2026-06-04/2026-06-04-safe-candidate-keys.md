# Safe Candidate Keys

- Goal: make source-candidate dedupe-key workflows usable from Windows shells by supporting a shell-safe `b64:` candidate key form.
- Constraints: preserve raw dedupe-key support; keep commands local/operator-only; do not change review, curation, or ingestion behavior; avoid changing public routes.
- Done condition: candidate list output includes a `key=b64:...` value, and dedupe-key commands accept that value anywhere they accept the raw key.
- Files likely touched: `src/lib/data/source-candidate-job-command.ts`, `src/lib/data/source-candidate-job-command.test.ts`, `docs/codex/source-candidate-workflow.md`, `docs/codex/handoff.md`.
- Steps: add base64url encode/decode helpers; use decoder for all dedupe-key CLI arguments; print safe keys in candidate-oriented output; document Windows-safe usage; validate with focused tests and real candidate detail/reference-match commands.
- Risks: malformed encoded keys should fail clearly; output must not imply evidence quality or review completion.

## Result

- Added shell-safe `key=b64:...` output next to raw source-candidate dedupe keys.
- Accepted `b64:` candidate keys anywhere the source-candidate command accepts a dedupe key, while preserving raw-key support.
- Documented Windows-safe copy/paste usage in the source-candidate workflow and handoff notes.
- Validation: focused command tests, real `--candidates` / `--candidate-detail` / `--candidate-reference-matches` smokes, full tests, lint, `dev:stop`, typecheck, build, and `git diff --check`.
