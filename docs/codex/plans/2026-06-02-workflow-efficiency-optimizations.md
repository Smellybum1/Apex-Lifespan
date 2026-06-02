# Workflow Efficiency Optimizations

## Goal

Implement the reported workflow optimizations: scoped validation, lighter planning for tiny fixes, leaner helper-agent use, and shorter project memory.

## Constraints

- Do not change app behavior.
- Keep `AGENTS.md` short.
- Move detailed workflow/reference material into `docs/codex/`.
- Preserve safety around medical accuracy, citation traceability, and public read-only boundaries.

## Done Condition

- Workflow docs include a validation matrix.
- Formal plan files are reserved for risky, multi-surface, schema, UI, or unclear work.
- Helper-agent guidance emphasizes nonblocking/high-value delegation.
- Detailed source-candidate command reference lives outside `docs/codex/project.md`.
- Diff review confirms this is docs/workflow-only.

## Files Likely Touched

- `AGENTS.md`
- `.agents/skills/project-workflow/SKILL.md`
- `docs/codex/workflow.md`
- `docs/codex/project.md`
- `docs/codex/source-candidate-workflow.md`

## Validation

- Docs-only diff review.
- `git diff --check`.

## Risks

- Avoid weakening validation for high-risk medical, schema, security, or UI work.
- Avoid creating conflicting planning rules across `AGENTS.md`, the skill, and workflow docs.
