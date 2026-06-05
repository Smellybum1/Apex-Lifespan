# Thread Handoff

Refreshed on 2026-06-05 after Evidence Map no-match empty state. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`; current code commit before this handoff refresh is `e6a407b Add evidence map empty state`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Public dashboard seed fallback now preflights missing, invalid, and unreachable `DATABASE_URL` states and uses sanitized public fallback reasons for Prisma query failures; strict `APEX_DATA_SOURCE=database` still fails instead of silently falling back.
- Public PubMed and ClinicalTrials.gov search routes now return stable public `502` messages for upstream/runtime failures instead of exposing raw integration exception text; request validation errors remain specific.
- Public live-source route parsing now normalizes `retmax`/`pageSize` before calling integrations: invalid or empty values use the route default, decimals are truncated, and results are clamped to 1-20.
- Dashboard live-source inputs and previews now reset to the active evidence card's suggested terms when the active claim changes, preventing stale live PubMed/ClinicalTrials.gov preview results from lingering beside a new curated source packet.
- Safety Center now renders a cautious empty state when no local safety alerts are captured; the wording tells users to check current regulator and clinical sources before treating anything as low risk.
- Trial Watcher now renders a cautious empty state when no local trial-watch records are captured; the wording directs users to current ClinicalTrials.gov checks and avoids implying no relevant trials exist.
- Claim Scores and Evidence Cards now render no-match empty states when the current search/category filters hide all local scored claims, with copy that points users back to clearing filters rather than implying no evidence exists.
- Evidence Map now renders the same no-match guidance instead of building an empty grid when current filters hide all local scored claims.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`.
- Public routes stay read-only and must not import source-candidate modules/persistence or promote source candidates; boundary tests cover static, dynamic, and CommonJS `source-candidate*` route imports.
- Source-candidate acceptance/rejection, claim linking, and study extraction stay explicit human-reviewed local writes. Accepted candidates still need curated references, claim links, and structured study extraction before public use.
- Guarded curation writes are `--link-candidate-claim` for `ClaimReference` and `--extract-candidate-study` for `Study`; neither creates references, source documents, decisions, or public promotions.
- Source-candidate CLI output provides copyable read-only review/curation drill-ins and Not-accepted accept-gate hints across summary, jobs, queues, detail, packets, reference matches, siblings, duplicates, curation views, review overview, review flags, and candidate lists.
- Duplicate identity review surfaces include `duplicateCaution`, `duplicateIdentityMixedDecision`, and read-only duplicate next actions when the same PMID/NCT spans multiple decision states. Use these cues to review scoped/unscoped identity context before any decision.
- Candidate filters support read-only `--candidate-claim-missing` and `--candidate-intervention-missing`; generated list hints use them when a group or candidate lacks claim/intervention context.
- Review overview top-candidate selection prefers repeated PMID/NCT identities when triage scores tie, so mixed accepted/pending duplicates are more visible from the overview.
- Source-candidate CLI now reports concise PostgreSQL-unavailable and sanitized missing/malformed `DATABASE_URL` messages, silences Prisma's own error logger for that local command path, exposes read-only `--db-status` to check connectivity before reading review data, includes `dbStatus="--db-status"` in summary next-command hints, and README/local-operations docs point local operators to the preflight before review/queue commands.
- Completed 2026-06-04 source-candidate plan files were moved to `docs/codex/plans/archive/2026-06-04/`; keep top-level `docs/codex/plans/` for active plans only.
- Startup/workflow docs reviewed during closeout: `AGENTS.md`, `docs/codex/project.md`, `docs/codex/workflow.md`, and `.agents/skills/project-workflow/SKILL.md` were already compact. This handoff was the clear bloat point, so its repeated historical validation log was compressed.

## Current Source-Candidate State

- Latest read-only summary: 15 ingestion jobs total, 0 queued jobs, 49 pending candidates, 1 accepted candidate, curation handoff `total=1`.
- Pending split: PubMed AU 19 and ClinicalTrials.gov AU 30.
- Accepted candidate: scoped PubMed AU `PMID 42141930` for `claim=creatine-strength` / `intervention=creatine`, accepted with `ref-pubmed-42141930`.
- Human review note for accepted `PMID 42141930`: "Human reviewed PMID 42141930; relevant to creatine and lean mass/strength outcomes, but needs curated reference before promotion."
- Current curation handoff status for accepted `PMID 42141930`: `Claim link missing`, `publicSourcePacketReady=false`. Do not link or extract without explicit human-owned curation.
- Duplicate scan currently shows one mixed PubMed identity group for `PMID 42141930`, with one pending unscoped row and one accepted scoped `creatine-strength` row.
- Review overview currently has 9 pending groups. Useful entry point: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
- Review flags currently show 3 flagged top groups: two broad `vitamin-d-deficiency` safety-query groups and one `creatine-lifespan` low-title-overlap group. Useful entry point: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`.
- Treat `vitamin-d-deficiency` results as broad-query leads; review title, population, outcomes, source identity, siblings, and reference matches carefully before any accept/reject decision.
- Notable current groups: `creatine-lifespan` has one ClinicalTrials.gov lead (`NCT07451496`); `omega-3-triglycerides` has ClinicalTrials.gov leads; `omega-3-cv-events` has PubMed and ClinicalTrials.gov leads.
- All current seeded claim-scoped source jobs have been queued and run. `psyllium` is seeded as an intervention but has no seeded claim.

## Latest Local Validation

Latest code validation for `e6a407b`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `6d94551`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `0068b26`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `539583b`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `4dc3333`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `c006445`:
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test -- src/app/api/live-source-readonly-boundary.test.ts`
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `c8b3971`:
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test -- src/app/api/live-source-readonly-boundary.test.ts`
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `c796a62`:
- `npm run test -- src/lib/data/dashboard.test.ts`
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `a1b322c`:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --db-status` with local PostgreSQL unavailable; expected concise DB guidance was printed.
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `b76ed84`:
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `652b085`:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --summary` with local PostgreSQL unavailable; expected concise DB guidance with preflight hint was printed.
- `npm run ingest:sources -- --db-status` with local PostgreSQL unavailable; expected concise DB guidance without recursive preflight hint was printed.
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `c9b4fee`:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --db-status` with local PostgreSQL unavailable; expected concise DB guidance was printed.
- `npm run ingest:sources -- --help`
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `e90aae9`:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --summary` with local PostgreSQL unavailable; expected concise DB guidance was printed.
- `npm run dev:stop`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Current environment note:
- Docker Compose config validates, but Docker daemon is not running; source-candidate DB review cannot continue until local PostgreSQL is started.

Latest code validation for `ac893f1`:
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- Read-only CLI smokes for review overview, review flags, summary, and exact `PMID 42141930` duplicate/review surfaces.
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Current closeout validation:
- `npm run ingest:sources -- --summary` (read-only state check)
- Startup/workflow docs and tracked workflow config reviewed.
- `git diff --check`

Older per-surface validation details live in git history and tests; do not replay old check matrices unless touching those surfaces.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Start with read-only review packets and duplicate identity context; do not accept/reject without human review.
- Queue claim-scoped sources only after new seeded claims are added or a claim needs an intentional re-query.
- Keep peptide/regulatory guardrails explicit and do not add sourcing, dosing, route, or self-administration guidance.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
