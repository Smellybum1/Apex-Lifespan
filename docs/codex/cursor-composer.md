# Cursor Composer Workflow

Use this when continuing Apex Lifespan in Cursor with Composer 2.5. Keep it simple.

## Start Prompt

Paste this into Composer when starting a new work session:

```text
You are working in D:\Codex\Apex Lifespan.

Read first:
- .cursor/rules/apex-lifespan.mdc
- AGENTS.md
- docs/codex/project.md
- docs/codex/roadmap.md
- docs/codex/handoff.md only for current dirty-tree state

Work in simplified hobby-project mode. Pick the most useful product-facing roadmap task, inspect the relevant files, make the change directly, and run the narrowest useful checks.

Do not create or revive readiness gates, queues, promotion chains, review packets, Composer monitoring, token-ratio tracking, launch rehearsals, roadmap bookkeeping, or command catalogs. Do not use old archive/generated/delegation logs as active instructions.

Hard stops: ask before production deploy, database mutation/migration, secrets, destructive actions, dependency/security changes, or medical/regulatory boundary changes. Preserve citation traceability, uncertainty labels, AU/TGA caveats, product-level evidence boundaries, no-medical-advice boundaries, and no peptide operational guidance.

Before editing, check the specific files you will touch and avoid unrelated dirty work. After editing, summarize changed files, checks run, and anything that still needs human attention.
```

## Good Composer Tasks

- Public dashboard/UI polish for already-existing data.
- Intervention detail page copy, layout, filters, and empty states.
- Traceable seed/data fixture additions when every citation and field is explicit.
- Small tests for changed UI/data helpers.
- Simple docs cleanup from current facts.

## Keep Out Of Composer Unless Explicit

- Architecture decisions and public contracts.
- Evidence methodology, scoring formulas, source trust, or citation semantics.
- Product-level ARTG/AUST decisions.
- Prisma migrations or database writes.
- Secrets, dependencies, security, production deploys, pushes, or PRs.

## Quick Check Menu

- Docs only: `git diff --check -- <files>`.
- UI/content: `npm run lint` or targeted tests if present.
- Shared TypeScript/data helpers: `npm run test` and `npm run typecheck`.
- Prisma schema changes: ask first, then `npm run db:validate` and `npm run db:generate`.

If Docker or local services are unavailable inside Cursor Cloud, keep working on tasks that do not need them or ask the user to run the local command. Do not invent remote database behavior from missing local services.
