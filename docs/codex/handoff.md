# Thread Handoff

Refreshed on 2026-06-04 after running the `creatine-lifespan` source jobs. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`.
- Verify latest commit with `git log -1 --oneline`; latest verified commit was `efa3511 Reduce Codex startup context`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

Last CLI snapshot after local ingestion:
- Ingestion jobs: total 5; PubMed AU succeeded 3; ClinicalTrials.gov AU succeeded 2.
- Queued jobs: 0.
- `creatine-lifespan` run results: PubMed job `cmpyz3plb00019jucj933g0x0` found 0/changed 0; ClinicalTrials.gov job `cmpyz3plf00039jucpvla4cgd` found 1/changed 1.
- Pending backlog: 11 candidates; PubMed AU 5 and ClinicalTrials.gov AU 6.
- New `creatine-lifespan` candidate: `NCT07451496`, triage 80/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBsb25nZXZpdHklMjBtb3J0YWxpdHklMjBsaWZlc3BhbnxuY3QwNzQ1MTQ5NnxjcmVhdGluZXxjcmVhdGluZS1saWZlc3Bhbg`; review packet showed no accepted-reference match and no siblings.
- Duplicate scan currently shows one pending PubMed identity group for PMID `42141930`.
- Curation handoff: 0 accepted candidates ready for next curation status buckets.
- Useful current view: `npm run ingest:sources -- --candidates --candidates-limit 10`.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Queue claim-scoped sources for the next unqueued claim target only after checking current queued jobs.
- Useful next queue target by seed order: `vitamin-d-deficiency`.
- Keep public promotion manual: accepted candidates still need curated references, claim links, and structured study extraction.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
