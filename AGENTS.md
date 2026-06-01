# AGENTS.md

## Codex rules
- Use `$project-workflow` for non-trivial features, bugs, refactors, tests, reviews, PR prep, or fuzzy implementation work. If local skills are unavailable, follow `.agents/skills/project-workflow/SKILL.md` manually.
- Keep this file under 80 lines; move workflow detail and learnings to `docs/codex/`.
- Inspect existing patterns before editing. Do not invent commands, architecture, or facts.
- Plan before multi-file or risky changes. Ask only blocking questions.
- When tooling supports it, use helper agents for bounded parallel research, review, test triage, or alternatives; keep final decisions and edits in this thread.
- Run the narrowest relevant checks first, then broader relevant checks before final.
- Treat instructions as compact trainable state: update only from validated evidence.
- Record rejected or obsolete instruction ideas in `docs/codex/rejected-edits.md`.

## Project commands
- Install: `npm install`
- Dev: `npm run dev`
- Test: TODO
- Lint/typecheck/build: `npm run lint`, `npm run typecheck`, `npm run build`
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:push`, `npm run db:seed`

## Project facts
- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma
- Key dirs: `src/app/`, `src/components/`, `src/lib/`, `prisma/`, `.agents/skills/project-workflow/`, `docs/codex/`
- Risk areas: medical claim accuracy, citation traceability, peptide/regulatory guardrails, dependency advisories
