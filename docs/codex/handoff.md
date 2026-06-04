# Thread Handoff

Refreshed on 2026-06-04 after running the `omega-3-triglycerides` source jobs. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`.
- Verify latest commit with `git log -1 --oneline`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`.
- Claim-scoped source queries now append compact claim-text anchors after outcome terms before queueing.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

Last CLI snapshot after local ingestion:
- Ingestion jobs: total 11; PubMed AU succeeded 6; ClinicalTrials.gov AU succeeded 5.
- Queued jobs: 0.
- `creatine-lifespan` run results: PubMed job `cmpyz3plb00019jucj933g0x0` found 0/changed 0; ClinicalTrials.gov job `cmpyz3plf00039jucpvla4cgd` found 1/changed 1.
- `vitamin-d-deficiency` run results: PubMed job `cmpyzabzh00019jtgj7q1i3pj` found 10/changed 10; ClinicalTrials.gov job `cmpyzabzl00039jtgc7rtk65i` found 10/changed 10.
- `vitamin-d-longevity` used claim-specific anchors (`already-sufficient adults`): PubMed job `cmpyzfqtq00019j7o22l97d0b` found 0/changed 0; ClinicalTrials.gov job `cmpyzfqtu00039j7oh2m44bc6` found 0/changed 0.
- `omega-3-triglycerides` used claim-specific anchors (`triglyceride lowering`): PubMed job `cmpyzjwyr00019jdgt4cmqzoe` found 0/changed 0; ClinicalTrials.gov job `cmpyzjwyv00039jdgvx0thukp` found 5/changed 5.
- Pending backlog: 36 candidates; PubMed AU 15 and ClinicalTrials.gov AU 21.
- New `creatine-lifespan` candidate: `NCT07451496`, triage 80/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBsb25nZXZpdHklMjBtb3J0YWxpdHklMjBsaWZlc3BhbnxuY3QwNzQ1MTQ5NnxjcmVhdGluZXxjcmVhdGluZS1saWZlc3Bhbg`; review packet showed no accepted-reference match and no siblings.
- Top `vitamin-d-deficiency` candidate: `NCT00715676`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`; review packet showed no accepted-reference match and 9 same-query siblings.
- `vitamin-d-deficiency` query was broad (`Vitamin D safety adverse effects`); claim-scoped lists include some likely off-target titles despite high triage scores.
- Top `omega-3-triglycerides` candidate: `NCT00435045`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBsaXBpZHMlMjB0cmlnbHljZXJpZGVzJTIwYXBvYiUyMHRyaWdseWNlcmlkZSUyMGxvd2VyaW5nfG5jdDAwNDM1MDQ1fG9tZWdhLTN8b21lZ2EtMy10cmlnbHljZXJpZGVz`; review packet showed no accepted-reference match and 4 same-query siblings.
- Duplicate scan currently shows one pending PubMed identity group for PMID `42141930`.
- Curation handoff: 0 accepted candidates ready for next curation status buckets.
- Useful current view: `npm run ingest:sources -- --candidates --candidates-limit 10`.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Treat existing `vitamin-d-deficiency` results as broad-query leads; review carefully before any accept/reject decision.
- Queue claim-scoped sources for the next unqueued claim target only after checking current queued jobs.
- Useful next queue target by seed order: `omega-3-cv-events`.
- Keep public promotion manual: accepted candidates still need curated references, claim links, and structured study extraction.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
