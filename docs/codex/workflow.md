# Codex Workflow

Use this only when process detail is actually needed.

## Default

- Read relevant files.
- Make the change.
- Run checks only when they are useful for the changed surface.
- Tell the user what changed.
- Do not add readiness gates, queue rituals, launch rehearsals, or review packets.

## Quick Validation Picker

- Docs-only: `git diff --check -- <changed-docs>`.
- UI/component behavior: targeted Vitest file for the component or helper, then `npm run typecheck:tsc -- --pretty false`.
- Shared data/scoring/source-packet behavior: targeted data tests plus a local sanity query or existing read-only script.
- Prisma/Next typegen behavior: full `npm run typecheck`, preferably after stopping the dev server on Windows if Prisma files are locked.
- Broad `npm run test`, `npm run lint`, or `npm run build` are milestone checks, not the default for every small local iteration.

## Source Of Truth

The simplified active docs win over old handoffs, `.ai/delegation/`, archived plans, checklists, runbooks, reference command catalogs, and generated logs. If an older doc recommends a queue, readiness gate, promotion chain, review packet, or launch rehearsal, treat it as retired unless the user explicitly requests that exact process.

Trust `package.json` for active `npm run` aliases. Missing aliases in legacy docs or script help are historical; inspect the script and run `npx tsx <script>` only if the task truly needs it.

## Dirty Worktrees

Do not clean, revert, stage, commit, or push unrelated work. Inspect task-owned paths with `git status`, `git diff -- <paths>`, and targeted reads.

## Hard Stops

Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.

Local evidence-map work may proceed as audited `AI reviewed` decisions when citation traceability, uncertainty labels, AU/TGA caveats, product-level boundaries, and medical/peptide-sourcing restrictions are preserved. Use `Human reviewed` only after explicit human confirmation.

## Plans

Most work needs no plan file. Create one only when it will clearly save time.
