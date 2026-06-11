# Thread Handoff

Refreshed on 2026-06-11 while trimming workflow guardrails for easier iteration. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this handoff only when resuming current work or needing operator state.
- Open `docs/codex/source-candidate-workflow.md` only for source ingestion/review/curation.
- Do not read archives wholesale; search them only for targeted history.

## Operator State

- Branch: `codex/queue-claim-sources`; latest pre-trim commit was `6889e65 Record local-only handoff state`.
- GitHub push limit remains active. Do not push to GitHub; make local commits only until the user lifts this constraint.
- Docker/PostgreSQL is not running as of 2026-06-11; `npm run ingest:sources -- --db-status` cannot reach `localhost:5432`.
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

Historical source-candidate progress lives in `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`; search it only for targeted evidence.
