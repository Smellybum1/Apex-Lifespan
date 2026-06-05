# Thread Handoff

Refreshed on 2026-06-05 after clarifying live preview score labels. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`; current code commit before this handoff refresh is `840c9e9 Clarify live preview score labels`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Public dashboard seed fallback now preflights missing, invalid, and unreachable `DATABASE_URL` states and uses sanitized public fallback reasons for Prisma query failures; strict `APEX_DATA_SOURCE=database` still fails instead of silently falling back.
- Public PubMed and ClinicalTrials.gov search routes now return stable public `502` messages for upstream/runtime failures instead of exposing raw integration exception text; request validation errors remain specific.
- Public live-source route parsing now normalizes `retmax`/`pageSize` before calling integrations: invalid or empty values use the route default, decimals are truncated, and results are clamped to 1-20.
- Public live-source route responses now send `Cache-Control: no-store` on successful previews, validation errors, and sanitized upstream failures so unreviewed live leads do not get cached as durable evidence.
- Public live-source route responses now also send `X-Robots-Tag: noindex`, keeping unreviewed preview JSON out of search indexing.
- PubMed and ClinicalTrials.gov live-source integrations now use `cache: "no-store"` for upstream fetches and do not set `next.revalidate`, keeping unreviewed live leads transient below the route response layer.
- PubMed and ClinicalTrials.gov live-source integrations now cap mapped response items to the normalized requested limit, so upstream over-returning cannot expand public preview packets.
- PubMed and ClinicalTrials.gov live-source integrations now defensively parse malformed-but-successful upstream payloads: non-array result lists become empty previews, bad PubMed counts become `0`, malformed IDs are ignored, and malformed trial/nested records are skipped or mapped with safe fallbacks.
- PubMed and ClinicalTrials.gov live-source integrations now trim upstream string arrays, identifiers, statuses, dates, and labels before mapping public preview links/chips; blank NCT IDs use the ClinicalTrials.gov root URL instead of a malformed study URL.
- Dashboard PubMed and ClinicalTrials.gov live-preview fetches now also use `cache: "no-store"` in the browser, with a component boundary test guarding both preview calls.
- Dashboard PubMed and ClinicalTrials.gov live-preview `/100` chips now say `Review priority`, and the preview panels state that scores rank review priority rather than evidence quality.
- Public live-source route tests now cover low `retmax`/`pageSize` values clamping to 1 before PubMed or ClinicalTrials.gov integrations are called.
- Public route boundary tests now fail if any `src/app/api/**/route.ts` file exports `POST`, `PUT`, `PATCH`, or `DELETE`, keeping public API handlers GET-only/read-only.
- Public route boundary tests now also fail on generic Prisma create/update/upsert/delete calls and raw execute calls from route handlers, while allowing read-only Prisma calls.
- Dashboard live-source inputs and previews now reset to the active evidence card's suggested terms when the active claim changes, preventing stale live PubMed/ClinicalTrials.gov preview results from lingering beside a new curated source packet.
- Public source-query suggestions now filter unsafe claim-derived self-use/preparation tokens such as injection, dosing, cycling, sourcing, reconstitution, and vials while preserving ordinary clinical context such as water retention.
- Safety Center now renders a cautious empty state when no local safety alerts are captured; the wording tells users to check current regulator and clinical sources before treating anything as low risk.
- Trial Watcher now renders a cautious empty state when no local trial-watch records are captured; the wording directs users to current ClinicalTrials.gov checks and avoids implying no relevant trials exist.
- Claim Scores and Evidence Cards now render no-match empty states when the current search/category filters hide all local scored claims, with copy that points users back to clearing filters rather than implying no evidence exists.
- Evidence Map now renders the same no-match guidance instead of building an empty grid when current filters hide all local scored claims.
- Active evidence-card panels now align with the visible filtered claim set when filters have matches, so ScorePanel and source-packet details do not keep showing a claim hidden by the current filters.
- ScorePanel and source/review queue areas now render filter-empty placeholders when the current filters match no local scored claims, instead of showing fallback hidden-claim details.
- Dashboard active-claim selection now handles an empty local claim set without dereferencing a missing fallback claim; list/map/card components receive an empty active id until claims exist.
- Vitest now discovers `.test.tsx` files and uses OXC automatic JSX transform, with a server-render regression covering cautious dashboard empty states when no local claims are available.
- Dashboard component regression coverage now also server-renders the seed-backed public dashboard and checks the active claim, source-packet, and suggested-search cues.
- Dashboard component regression coverage now keeps source-packet extraction completion separate from human review status, asserting complete seed source packets still render alongside unreviewed-draft review cues.
- Dashboard component regression coverage now verifies sanitized seed fallback reasons render in the public header beside the Seed fallback state.
- Seed integrity regression coverage now checks that seeded claim key references, study references, and AU/TGA regulatory reference IDs resolve to curated references, and that AU/TGA source URLs stay aligned with their referenced curated source record.
- Seed integrity regression coverage now also checks seeded claim, safety-alert, trial-watch, and AU/TGA status intervention links, product-level AU/TGA status links, and exactly-one intervention/product target per seeded AU/TGA status.
- Seed integrity helper now reports duplicate expected/actual IDs by default, with explicit duplicate allowances for relationship checks where repeated target IDs are valid.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Label-risk TGA approval overclaim detection now uses one Unicode-aware negation guardrail for `isn't` / `isn\u2019t` / `isnt` forms instead of duplicated apostrophe handling.
- Label-risk TGA AUST-number findings now link to the same curated `tga-aust-numbers` seed reference URL used by product and regulatory status records.
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

Latest code validation for `840c9e9`:
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/components/evidence-dashboard.test.tsx src/components/evidence-dashboard-live-preview-boundary.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `8714697`:
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/lib/source-queries.test.ts`
- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `5bb1ac9`:
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `67a43d6`:
- `npm run test -- src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test -- src/app/api/source-search-routes.test.ts src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `a768327`:
- `npm run test -- src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test -- src/app/api/source-search-routes.test.ts src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `4b10f1f`:
- `npm run test -- src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test -- src/app/api/source-search-routes.test.ts src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `2bda36e`:
- `npm run test -- src/app/api/live-source-readonly-boundary.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `a383046`:
- `npm run test -- src/lib/seed-integrity.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Latest code validation for `a2cdd69`:
- `npm run test -- src/lib/seed-integrity.test.ts`
- `npm run lint`
- `npm run test`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `44ddd8a`:
- `npm run test -- src/lib/seed-integrity.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `9c90f90`:
- `npm run test -- src/lib/scoring.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `7e0adac`:
- `npm run test -- src/lib/scoring.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `2a88cf6`:
- `npm run test -- src/components/evidence-dashboard-live-preview-boundary.test.ts`
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `4f07ffc`:
- `npm run test -- src/lib/integrations/pubmed.test.ts src/lib/integrations/clinical-trials.test.ts src/app/api/source-search-routes.test.ts src/app/api/live-source-readonly-boundary.test.ts`
- `npm run lint`
- `npm run test`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `df8a7be`:
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `782c3f7`:
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `2873655`:
- `npm run test -- src/app/api/live-source-readonly-boundary.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `ca3e35a`:
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `e2dbcfd`:
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `0e67339`:
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `4bb1dde`:
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `deeebfc`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `74fb581`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

Latest code validation for `9673a4e`:
- `npm run dev:stop`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)

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
- Latest read-only `npm run ingest:sources -- --db-status` still cannot reach PostgreSQL at `localhost:5432`; source-candidate DB review cannot continue until local PostgreSQL is started.

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
