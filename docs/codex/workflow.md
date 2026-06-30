# Codex Workflow

Use this only when process detail is actually needed.

## Default

- Read relevant files.
- Make the change.
- Run checks only when they are useful for the changed surface.
- Tell the user what changed.
- Do not add readiness gates, queue rituals, launch rehearsals, or review packets.

## Source Of Truth

The simplified active docs win over old handoffs, `.ai/delegation/`, archived plans, checklists, runbooks, reference command catalogs, and generated logs. If an older doc recommends a queue, readiness gate, promotion chain, review packet, or launch rehearsal, treat it as retired unless the user explicitly requests that exact process.

## Dirty Worktrees

Do not clean, revert, stage, commit, or push unrelated work. Inspect task-owned paths with `git status`, `git diff -- <paths>`, and targeted reads.

## Hard Stops

Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.

Local evidence-map work may proceed as audited `AI reviewed` decisions when citation traceability, uncertainty labels, AU/TGA caveats, product-level boundaries, and medical/peptide-sourcing restrictions are preserved. Use `Human reviewed` only after explicit human confirmation.

## Plans

Most work needs no plan file. Create one only when it will clearly save time.
