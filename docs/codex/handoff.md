# Thread Handoff

Refreshed on 2026-06-11 while trimming workflow guardrails for easier iteration. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this handoff only when resuming current work or needing operator state.
- Open `docs/codex/source-candidate-workflow.md` only for source ingestion/review/curation.
- Do not read archives wholesale; search them only for targeted history.

## Operator State

- Branch: `codex/queue-claim-sources`; latest pre-trim commit was `6889e65 Record local-only handoff state`.
- GitHub push limit was lifted on 2026-06-11. Push to GitHub when useful.
- Docker Compose PostgreSQL is running and healthy as of 2026-06-11; `npm run ingest:sources -- --db-status` reports `reachable=true`.
- Current roadmap: `docs/codex/roadmap.md` targets the public live MVP/demo and includes the automatic rollover rule for the fully live end-product roadmap.

## Keep

- Public routes and dashboard remain read-only; review/admin writes stay local operator-only.
- Australia/TGA is the default lens; product-level confidence needs product-level evidence.
- Live PubMed and ClinicalTrials.gov previews are unreviewed leads; `/100` values are triage/review priority, not evidence quality.
- Source-candidate accept/reject, claim linking, and study extraction remain explicit human-reviewed local writes under `npm run ingest:sources`.
- Accepted candidates do not become public evidence until a matching curated reference is claim-linked and structurally extracted.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Simplified

- Do not preserve long CLI output contracts in this handoff. Use `npm run ingest:sources -- --help` and `docs/codex/source-candidate-workflow.md` for current operator commands.
- Use inline plans for ordinary multi-file work. Create `docs/codex/plans/` files only for genuinely risky, unclear, schema/API/security, public-boundary, or hard-to-validate changes.
- Prefer tests/code boundaries over adding more startup instructions. Add docs only when they reduce future context load.

## Source-Candidate Snapshot

- Latest known successful summary: 15 ingestion jobs total, 49 pending candidates, 1 accepted candidate, curation handoff `total=1`.
- Pending split: PubMed AU 19 and ClinicalTrials.gov AU 30.
- Accepted candidate: scoped PubMed AU `PMID 42141930` for `claim=creatine-strength` / `intervention=creatine`, accepted with `ref-pubmed-42141930`.
- Accepted `PMID 42141930` still needs human-owned curation: status `Claim link missing`, `publicSourcePacketReady=false`.
- Duplicate scan showed one mixed PubMed identity group for `PMID 42141930`: one pending unscoped row plus one accepted scoped `creatine-strength` row.
- Review overview had 9 pending groups. Useful entry point: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
- Review flags had 3 flagged top groups: two broad `vitamin-d-deficiency` safety-query groups and one `creatine-lifespan` low-title-overlap group.

## Latest Local Validation

- Startup docs and repo-local workflow skill re-read.
- `git status -sb`
- `git log -3 --oneline`
- `docker compose ps` failed because Docker Desktop was not running.
- `npm run ingest:sources -- --db-status` failed because PostgreSQL was unreachable at `localhost:5432`.
- Roadmap step 1 completed: `git status -sb` showed a clean branch ahead of origin by 3 commits, and `git log -3 --oneline` confirmed the latest local commits.
- Roadmap step 2 completed after launching Docker Desktop: `docker compose ps`, `npm run db:migrate`, `npm run db:seed`, and `npm run ingest:sources -- --db-status` passed.
- Roadmap step 3 completed: README selects `APEX_DATA_SOURCE=seed` for the public MVP/demo and keeps managed PostgreSQL for a later production-data milestone.
- Roadmap step 4 completed: seed-mode desktop/mobile browser review passed, public product-card brand copy changed from `Seed example` to `Demo profile`, `npm run db:seed` refreshed local data, and targeted dashboard/source-packet/seed-integrity tests passed.
- Roadmap step 5 completed by explicit MVP deferral: `npm run ingest:sources -- --candidate-curation-handoff` still reports accepted `PMID 42141930` as `Claim link missing` with `publicSourcePacketReady=false`, so it stays local curation backlog and is not promoted into the public MVP.
- Roadmap step 6 completed: public route/read-only boundary tests passed for live-source routes, dashboard live-preview fetches, public-safe errors, no-store/noindex headers, and source-candidate workflow separation.
- Roadmap step 7 completed: README selects manual Vercel CLI deployment from the local checkout as the no-GitHub path and documents env, build/local smoke commands, public smoke targets, and rollback. After GitHub push access was restored, the preferred path became GitHub import to Vercel after pushing this branch.
- Roadmap step 8 completed: `.env.example` and README document public-demo `APEX_DATA_SOURCE=seed`; public deploy should omit `DATABASE_URL` and all local Codex sidecar variables.
- Roadmap step 9 completed for the current local build: `npm run test`, `npm run lint`, `npm run dev:stop`, `npm run typecheck`, `npm run build`, and `npm audit` passed.
- Roadmap step 10 completed for the current seed-mode production build: desktop/mobile screenshots and PubMed/ClinicalTrials.gov live-preview smokes passed, then `npm run dev:stop` stopped the production server.
- Roadmap steps 11-13 are blocked until Vercel deployment produces a public URL, launch handoff details, and final public smoke evidence. Use `npm run smoke:public-mvp -- <url>` for final public smoke once a URL exists; it passed against `http://127.0.0.1:3000` on a seed-mode production server. Launch handoff draft is `docs/codex/public-mvp-launch-handoff.md`.

Historical source-candidate progress lives in `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`; search it only for targeted evidence.
