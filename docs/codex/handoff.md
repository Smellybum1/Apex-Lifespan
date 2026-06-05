# Thread Handoff

Refreshed on 2026-06-05 after stripping hidden live source term controls. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`; current code commit before this handoff refresh is `baeeeeb Strip hidden live source term controls`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Public dashboard seed fallback preflights missing, invalid, and unreachable `DATABASE_URL` states and uses sanitized public fallback reasons for Prisma query failures; strict `APEX_DATA_SOURCE=database` still fails instead of silently falling back.
- Public live PubMed and ClinicalTrials.gov previews are unreviewed leads, not curated evidence. Route responses use `Cache-Control: no-store` and `X-Robots-Tag: noindex`; browser fetches also use `cache: "no-store"`.
- Public live-source routes sanitize upstream errors, normalize/bound result limits, defensively parse malformed upstream payloads, trim upstream strings, and cap returned items to normalized requested limits.
- Public PubMed and ClinicalTrials.gov search requests strip hidden control/bidi characters, bound raw normalized query length before unsafe-term scrubbing, then scrub route/preparation/sourcing terms such as injection, reconstitution, vials, sterile/bacteriostatic water, self-administration, suppliers, and purchase language before upstream calls; terms made only of those words are rejected as non-citation-oriented.
- Dashboard live-preview submissions use the same live-source term scrubber before storing request state, and live-preview `/100` chips say `Review priority` with copy that scores rank review priority rather than evidence quality.
- Dashboard live-source inputs and previews reset to the active evidence card's suggested terms when the active claim changes, preventing stale live preview results from lingering beside a new curated source packet.
- Public source-query suggestions filter unsafe claim-derived self-use/preparation tokens such as injection, dosing, cycling, sourcing, reconstitution, and vials while preserving ordinary clinical context such as water retention.
- Public route and public-surface boundary tests keep public API handlers GET-only/read-only, disallow source-candidate imports/persistence helpers, disallow Prisma writes/raw execute calls, and scan runtime public app/component/dashboard files excluding tests.
- Evidence cards keep source-packet extraction completion separate from human review status; seed dashboard coverage checks active claim, source-packet, suggested-search, review-status, and sanitized seed fallback cues.
- Empty/no-match dashboard states are cautious: they do not imply no evidence, no local warnings imply safety, no trial-watch records imply no trials, or no active card exists when filters hide local claims.
- Seed integrity coverage checks seeded claim key references, study references, AU/TGA regulatory reference IDs, intervention/product target links, and AU/TGA source URL alignment with curated source records.
- Label-risk guardrails keep AU/TGA peptide, AUST-number, and TGA-approval overclaim checks visible; AUST-number findings link to the curated `tga-aust-numbers` seed reference.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`; public routes must not import source-candidate modules or promote source candidates.
- Source-candidate acceptance/rejection, claim linking, and study extraction stay explicit human-reviewed local writes. Accepted candidates still need curated references, claim links, and structured study extraction before public use.
- Guarded curation writes are `--link-candidate-claim` for `ClaimReference` and `--extract-candidate-study` for `Study`; neither creates references, source documents, decisions, or public promotions.
- Source-candidate CLI output provides copyable read-only review/curation drill-ins and Not-accepted accept-gate hints across summary, jobs, queues, detail, packets, reference matches, siblings, duplicates, curation views, review overview, review flags, and candidate lists.
- Duplicate identity review surfaces include `duplicateCaution`, `duplicateIdentityMixedDecision`, and read-only duplicate next actions when the same PMID/NCT spans multiple decision states. Use these cues to review scoped/unscoped identity context before any decision.
- Candidate filters support read-only `--candidate-claim-missing` and `--candidate-intervention-missing`; generated list hints use them when a group or candidate lacks claim/intervention context.
- Review overview top-candidate selection prefers repeated PMID/NCT identities when triage scores tie, so mixed accepted/pending duplicates are more visible from the overview.
- Source-candidate CLI reports concise PostgreSQL-unavailable and sanitized missing/malformed `DATABASE_URL` messages, silences Prisma's own error logger for that local command path, exposes read-only `--db-status`, includes `dbStatus="--db-status"` in summary next-command hints, and docs point local operators to the preflight before review/queue commands.
- Completed 2026-06-04 source-candidate plan files were moved to `docs/codex/plans/archive/2026-06-04/`; keep top-level `docs/codex/plans/` for active plans only.

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
- Current environment note: read-only `npm run ingest:sources -- --db-status` still cannot reach PostgreSQL at `localhost:5432`; source-candidate DB review cannot continue until local PostgreSQL is started.

## Latest Local Validation

Latest code validation for `baeeeeb`:
- Startup/workflow docs and current state re-read.
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Previous code validation for `6cdd9ae`:
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/app/api/source-search-routes.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Earlier code validation for `72be953`:
- `npm run ingest:sources -- --db-status` (read-only preflight; PostgreSQL still unavailable at `localhost:5432`)
- `npm run test -- src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts`
- `npm run test -- src/components/evidence-dashboard.test.tsx`
- `npm run test -- src/app/api/source-search-routes.test.ts src/components/evidence-dashboard-live-preview-boundary.test.ts src/components/evidence-dashboard.test.tsx`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `npm run build`
- `git diff --check` (only LF-to-CRLF warnings for modified files before commit)
- `git diff --cached --check`

Older per-surface validation details live in git history and tests; do not replay old check matrices unless touching those surfaces.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices once local PostgreSQL is available.
- Start with read-only review packets and duplicate identity context; do not accept/reject without human review.
- Queue claim-scoped sources only after new seeded claims are added or a claim needs an intentional re-query.
- Keep peptide/regulatory guardrails explicit and do not add sourcing, dosing, route, or self-administration guidance.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
