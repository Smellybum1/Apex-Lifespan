# Codex Workflow

Use the smallest loop that can safely finish the task.

## Loops

- Quick fix: inspect, edit, targeted validation, final.
- Plan loop: outcome, research, brief plan, work, validate, review, final.
- Full loop: outcome, brainstorm if needed, plan, work, validate, review, polish, compound.

Non-trivial work means multi-file changes, user-facing behavior, unclear requirements, shared abstractions, data/schema/API changes, security/auth/input handling, or changes where validation is not obvious.

## Helper Agents

When tooling supports it, use helper agents for bounded parallel work such as repo reconnaissance, option comparison, test-failure triage, diff review, UI QA, or docs checks.

Give each helper a narrow question and synthesize results in the main thread. Delegation does not replace local validation or final judgment.

## Planning

For non-trivial work, create `docs/codex/plans/YYYY-MM-DD-slug.md` before editing. Keep the plan brief and update it only when the direction materially changes.

A plan should cover:
- Goal
- Constraints
- Done condition
- Files likely touched
- Steps
- Validation
- Risks

Ask only blocking questions. If a reasonable, low-risk assumption is available, state it and proceed.

## Work

Inspect existing code, docs, `docs/codex/project.md`, and relevant learnings before changing files. Prefer repo evidence over invention.

Make small coherent diffs and preserve local naming, structure, formatting, and dependency choices. Use a branch or worktree for large or risky work when appropriate.

## Validation

Run the narrowest useful check first, then broader relevant checks before final. Record exact commands and results in the final response or the plan when useful.

If commands are unknown, discover them from repo files. If they cannot be discovered, mark them as TODO in `docs/codex/project.md` rather than guessing.

## Review

Before final, inspect the diff for correctness, tests, maintainability, and project rules.

Apply extra lenses when relevant:
- Security: auth, authorization, input handling, secrets, dependencies.
- Performance: loops, rendering, database access, caching, payload size.
- API/data safety: contracts, schemas, migrations, serialization, backward compatibility.
- UI: real flows, empty/loading/error states, copy, keyboard/mouse behavior, responsiveness, and visual glitches.

## Compound Learning

Capture only reusable, validated lessons. A learning needs evidence, validation, and a reason it will improve future work.

Store detailed lessons in `docs/codex/learnings/YYYY-MM-DD-topic.md`.

Update instructions only from evidence such as repeated failure, confirmed review issue, discovered command, validated pattern, or repeated user preference.

Before editing instructions, check:
- Is there evidence?
- Is this the smallest useful edit?
- Would it have prevented the issue or made validation faster or safer?

Prefer safety nets over manual burden: tests, scripts, checks, docs, or narrower skill rules.

Use bounded instruction edits: max 5 bullet changes per task; prefer replace/delete over append. Record rejected or obsolete instruction ideas in `docs/codex/rejected-edits.md` as one-line notes.

## Final Response

For implementation work, report:
- Summary
- Files changed
- Checks run
- Risks/open items
- Learning captured: yes/no
