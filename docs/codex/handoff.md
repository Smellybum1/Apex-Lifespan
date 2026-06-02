# Thread Handoff

Created for a new Codex thread on 2026-06-02.

## Start Here

1. Read `AGENTS.md`.
2. Use `$project-workflow`; if the skill is unavailable, read `.agents/skills/project-workflow/SKILL.md`.
3. Read `docs/codex/project.md` and `docs/codex/source-candidate-workflow.md`.
4. Run `git status -sb` before edits.
5. For docs-only memory edits, review the diff and run `git diff --check`.

## Current State

- Expected handoff state: `main` clean and even with `origin/main` after this docs-only handoff commit is pushed.
- Last feature commit before this handoff: `5f4832e Validate source candidate job context`.
- The app is a public read-only Next.js evidence dashboard with PostgreSQL/Prisma support and seed fallback.
- Default lens is Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Public live-source API routes must stay read-only and must not import or call source-candidate persistence.
- Source-candidate ingestion and review remain local operator-only under `npm run ingest:sources`.
- The recent ingestion-job context migration exists and was validated/generated/built, but was not applied to a local PostgreSQL database; this pass also could not start Postgres because `docker` was unavailable on PATH. Apply migrations locally before DB-backed manual checks.

## Recent Work

- Guarded source-candidate curation readiness:
  - accepted-reference mismatch blocks readiness;
  - accepted candidates without a claim id report `Candidate claim missing`;
  - curation handoff status remains source-packet readiness, not evidence quality.
- Added database-mode regression coverage for public source-packet mapping:
  - mocked Prisma rows now verify claim reference links and structured study extraction rows map into a complete source packet;
  - coverage confirms database dashboard data preserves curated reference identity needed by the public Sources panel.
- Added a read-only same-identity candidate sibling view:
  - `--candidate-siblings <dedupe-key>` shows same-source/external-id and same-query/context rows with match reasons;
  - output stays local/operator-only and does not automate source-candidate decisions.
- Scoped source-candidate ingestion-job identity:
  - `IngestionJob` now has first-class `interventionId` and `claimId`;
  - migration `20260602061000_ingestion_job_context_identity` backfills valid legacy metadata context;
  - PostgreSQL partial unique indexes separate unscoped, intervention, claim, and intervention+claim queue buckets.
- Validated queue context:
  - missing claim or intervention ids fail before job creation;
  - claim+intervention queueing requires the claim to belong to that intervention;
  - claim-only queueing remains allowed after validating the claim exists.

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
- `npm run db:validate`
- `npm run build`
- HTTP smoke for `http://localhost:3000` returned `200`

## Useful Next Tasks

- Apply and verify the committed migrations against local PostgreSQL, then seed:
  - `docker compose up -d postgres`
  - `npm run db:migrate`
  - `npm run db:seed`
- Later, design an operator workflow to create or curate references/extractions from accepted candidates without auto-promoting public evidence.

## Guardrails

- Keep medical claims citation-traceable and review-status visible.
- Keep live PubMed/ClinicalTrials.gov previews labeled as unreviewed leads.
- Keep source-candidate curation wording framed as handoff/readiness, not source quality or medical advice.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.
