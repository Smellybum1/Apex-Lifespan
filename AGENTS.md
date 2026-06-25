# AGENTS.md

## Codex Rules
- Hobby-project mode: read only what is relevant, make the useful change, and keep moving.
- Do not create process artifacts, handoff history, roadmap micro-goals, or Composer contracts unless they clearly save time right now.
- Startup scope: read `AGENTS.md` and `docs/codex/project.md`; read `docs/codex/handoff.md` only when resuming.
- Current active docs win: this file, `docs/codex/project.md`, `docs/codex/roadmap.md`, and current `docs/codex/handoff.md` override older handoffs, archive docs, `.ai/delegation/`, legacy checklist/runbook/workflow docs, and generated logs.
- Avoid `docs/codex/archive/`, `docs/codex/plans/archive/`, `docs/codex/reference/`, generated `output/`, `.ai/delegation/`, and command catalogs unless the task specifically needs them.
- Inspect existing patterns before editing. Do not invent commands, architecture, or facts.
- Routine local code, docs, tests, read-only UI, and dry-run tooling should proceed autonomously.
- Ask first only before production deploy, DB/secret/destructive actions, or medical/regulatory boundary changes.
- Local evidence-map work may use audited `AI reviewed` decisions when citation traceability, uncertainty labels, AU/TGA caveats, product-level boundaries, and no-medical-advice/no-peptide-operational-guidance rules are preserved. Use `Human reviewed` only after explicit human confirmation.
- The active npm command surface is intentionally tiny. Do not resurrect readiness, queue, promotion, Composer, launch, or review-gate scripts unless the user explicitly asks.
- If a task is only readiness, queue, promotion, Composer monitoring, review packets, launch rehearsal, or roadmap bookkeeping, stop and pick product-facing roadmap work instead.
- Delete process that slows the project down.

## Project Commands
- Install/dev: `npm install`, `npm run dev`
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:push`, `npm run db:seed`

## Project Facts
- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma
- Key dirs: `src/app/`, `src/components/`, `src/lib/`, `prisma/`, `docs/codex/`
- Risk areas: medical claim accuracy, citation traceability, peptide/regulatory boundaries, dependency advisories
