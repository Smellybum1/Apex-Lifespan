# Context Efficiency Refactor

- Goal: reduce normal Codex startup context while preserving project guardrails and detailed references.
- Constraints: docs-only; no app code changes; keep startup instructions accurate; avoid losing medical/regulatory and public-read-only boundaries.
- Done condition: startup/read-first docs are shorter, command catalogs move to reference docs, handoff is current-state only, and archive/reference docs are clearly not startup context.
- Files likely touched: `AGENTS.md`, `.agents/skills/project-workflow/SKILL.md`, `docs/codex/workflow.md`, `docs/codex/project.md`, `docs/codex/handoff.md`, `docs/codex/source-candidate-workflow.md`, `docs/codex/plans/README.md`, `README.md`, new `docs/codex/reference/*`.
- Validation: size table before/after and `git diff --check`.
- Risks: over-compressing guardrails could weaken safety around source-candidate writes, medical claims, or compaction recovery.

## Result

- Startup scope now points normal threads to `AGENTS.md` and `docs/codex/project.md`, with `handoff.md`, source-candidate docs, references, and archives loaded only when relevant.
- Split detailed workflow, source-candidate command catalog, and local operations into reference docs.
- Slimmed `README.md`, `docs/codex/project.md`, `docs/codex/handoff.md`, `docs/codex/workflow.md`, and `docs/codex/source-candidate-workflow.md`.
- Archived source-candidate progress history outside the active handoff.
- Validation: after-size tables and `git diff --check`.
