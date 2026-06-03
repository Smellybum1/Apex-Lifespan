# Thread Handoff

Refreshed on 2026-06-03. Treat the worktree as authoritative: run `git status -sb` and `git log -1 --oneline` before edits.

## Start Here

1. Read `AGENTS.md`.
2. Use `$project-workflow`; if unavailable, read `.agents/skills/project-workflow/SKILL.md`.
3. Read `docs/codex/project.md` for stable memory.
4. Read `docs/codex/source-candidate-workflow.md` before ingestion or curation work.
5. For docs-only memory edits, review the diff and run `git diff --check`.

## Current State

- The app is a public read-only Next.js evidence dashboard with PostgreSQL/Prisma support and seed fallback.
- Default lens is Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Public live-source API routes must stay read-only and must not import or call source-candidate persistence.
- Source-candidate ingestion and review remain local operator-only under `npm run ingest:sources`.
- The committed ingestion-job context migration still needs local PostgreSQL application before DB-backed manual checks.

## Recent Source-Candidate Work

- Curation readiness is guarded:
  - accepted-reference mismatch blocks readiness;
  - accepted candidates without a claim id report `Candidate claim missing`;
  - handoff/status wording stays source-packet readiness, not evidence quality.
- Database-mode dashboard regression coverage verifies claim reference links and structured study extraction rows map into complete public source packets.
- Operator-only curation views now include candidate detail, siblings, reference matches, curation status, curation draft, curation handoff, and summary.
- Review actions can accept/reject pending candidates with human constraints.
- `--link-candidate-claim <dedupe-key>` is a guarded local write that upserts only the accepted reference's `ClaimReference`; it does not create references, studies, or public promotions.
- Ingestion job identity is source/query/region plus optional intervention and claim context; PostgreSQL partial unique indexes separate unscoped, intervention, claim, and intervention+claim queue buckets.
- Queueing validates requested intervention/claim context before job creation.

## Recent Validation

- `npm run db:validate`
- `npm run db:generate`
- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/dashboard.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- HTTP smoke for `http://localhost:3000` returned `200`

## Useful Next Tasks

- Apply and verify the committed migrations against local PostgreSQL, then seed:
  - `docker compose up -d postgres`
  - `npm run db:migrate`
  - `npm run db:seed`
- Later, decide whether to add a guarded local study-extraction write command; keep public promotion human-reviewed and never automatic.

## Guardrails

- Keep medical claims citation-traceable and review-status visible.
- Keep live PubMed/ClinicalTrials.gov previews labeled as unreviewed leads.
- Keep source-candidate curation wording framed as handoff/readiness, not source quality or medical advice.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.
