# Project Memory

Compact, stable Codex state. Do not turn this into a command catalog or progress log.

## Shape

- Stack: Next.js, TypeScript, Tailwind CSS, TanStack Table, Recharts, PostgreSQL, Prisma, Node/npm.
- App Router: `src/app/`; dashboard UI: `src/components/evidence-dashboard.tsx`.
- Domain types, seed data, scoring, regulatory labels, and data helpers: `src/lib/`.
- Public source wrappers: `src/lib/integrations/`; public API routes: `src/app/api/`.
- Prisma schema, migrations, and seed script: `prisma/`.

## Commands

- Install/dev: `npm install`, `npm run dev`, `npm run dev:stop`.
- Test/build: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Database: `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:push`, `npm run db:seed`.
- Source-candidate CLI: `npm run ingest:sources -- --help`; open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Codex review sidecar: `npm run codex:review-sidecar` for token-gated local dashboard packets.

## Boundaries

- MVP is public read-only; review/admin writes stay local operator-only.
- Dashboard reads through `src/lib/data/dashboard.ts`; it prefers Prisma when reachable and falls back to seed data unless `APEX_DATA_SOURCE=database`.
- Public live-source API routes must not import or call source-candidate persistence.
- Dashboard-to-Codex packet sends go through the local sidecar, not public Next.js API routes.
- Live PubMed and ClinicalTrials.gov previews are unreviewed leads; `/100` values are triage scores, not evidence quality.
- Source-candidate ingestion/review writes live only under `npm run ingest:sources`.
- Accepted source candidates require a matching curated reference and human review note, and never auto-promote into public evidence cards.
- Guarded curation writes are `--link-candidate-claim` for `ClaimReference` and `--extract-candidate-study` for `Study`; neither creates references, source documents, decisions, or public promotions.

## Product Rules

- Default lens: Australia/TGA.
- Do not infer ARTG/AUST status from generic intervention evidence; product-level confidence needs product-level evidence.
- Evidence cards stay citation-traceable with review status visible.
- Label-risk empty states say no local warnings were found; they do not imply safety, efficacy, or TGA clearance.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Validation

- Use `docs/codex/workflow.md` for the compact check matrix; open `docs/codex/reference/workflow.md` for details.
- On Windows, run `npm run dev:stop` before Prisma-generating checks such as `npm run typecheck` or `npm run build`.
- Include `db:validate`/`db:generate` for Prisma schema, migration, or generated-client changes.
- Run `docker compose config` after Compose changes and `npm audit` after dependency changes.

## Reference Docs

- Local DB and operator setup: `docs/codex/reference/local-operations.md`.
- Full source-candidate command catalog: `docs/codex/reference/source-candidate-command-reference.md`.
- Current/resume-only state: `docs/codex/handoff.md`.
- Completed plans and historical handoffs are archive context; search them only for targeted evidence.
