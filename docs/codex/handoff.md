# Thread Handoff

Refreshed on 2026-06-04 after context-efficiency work. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`.
- Verify latest commit with `git log -1 --oneline`; this handoff was prepared during the context-efficiency docs refactor.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

Last read-only CLI snapshot:
- Ingestion jobs: total 3; PubMed AU succeeded 2; ClinicalTrials.gov AU succeeded 1.
- Queued jobs: 0.
- Pending backlog: 10 candidates; PubMed AU 5 and ClinicalTrials.gov AU 5.
- Curation handoff: 0 accepted candidates ready for next curation status buckets.
- Useful current view: `npm run ingest:sources -- --candidates --candidates-limit 10`.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Queue claim-scoped sources for the next claim target with `--queue-claim-sources <claim-id>`.
- Keep public promotion manual: accepted candidates still need curated references, claim links, and structured study extraction.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
