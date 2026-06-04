# Thread Handoff

Refreshed on 2026-06-04 after adding source-candidate job row hints. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

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
- Summary output is read-only and prints next-command hints for overview, duplicate scan, queued jobs, and curation handoff; non-empty curation status bucket rows include filtered handoff hints.
- Job rows are read-only and print candidate-list, context-jobs, and status-jobs hints.
- Review overview is read-only and prints region-qualified `list="..."` filtered queue hints, `packet="..."` top-candidate hints, and duplicate hints when the top identity repeats.
- Candidate detail output is read-only and prints packet, reference-match, sibling, group-list, curation-status, and curation-draft hints.
- Candidate list rows are read-only and print `packet="..."` hints for direct packet review.
- Reference-match headings print read-only `packet="..."` and `groupList="..."` hints; reference drafts remain draft-only.
- Review packets print safe read-only follow-up commands, duplicate hints when the identity repeats, and explicit human-reviewed accept/reject templates.
- Sibling rows print read-only `packet="..."` hints for related candidate packet review.
- Duplicate identity output prints read-only `identityList="..."` and per-candidate `packet="..."` hints.
- Curation handoff rows print read-only packet, reference-match, curation-status, and curation-draft hints when rows exist.
- Curation status and draft output print read-only packet, reference-match, group-list, and paired curation-view hints.
- Claim-scoped source queries now append compact claim-text anchors after outcome terms before queueing.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

Last CLI snapshot after local ingestion:
- Ingestion jobs: total 15; PubMed AU succeeded 8; ClinicalTrials.gov AU succeeded 7.
- Queued jobs: 0.
- `creatine-lifespan` run results: PubMed job `cmpyz3plb00019jucj933g0x0` found 0/changed 0; ClinicalTrials.gov job `cmpyz3plf00039jucpvla4cgd` found 1/changed 1.
- `vitamin-d-deficiency` run results: PubMed job `cmpyzabzh00019jtgj7q1i3pj` found 10/changed 10; ClinicalTrials.gov job `cmpyzabzl00039jtgc7rtk65i` found 10/changed 10.
- `vitamin-d-longevity` used claim-specific anchors (`already-sufficient adults`): PubMed job `cmpyzfqtq00019j7o22l97d0b` found 0/changed 0; ClinicalTrials.gov job `cmpyzfqtu00039j7oh2m44bc6` found 0/changed 0.
- `omega-3-triglycerides` used claim-specific anchors (`triglyceride lowering`): PubMed job `cmpyzjwyr00019jdgt4cmqzoe` found 0/changed 0; ClinicalTrials.gov job `cmpyzjwyv00039jdgvx0thukp` found 5/changed 5.
- `omega-3-cv-events` run results: PubMed job `cmpyzoc7000019jwckirn1fo0` found 5/changed 5; ClinicalTrials.gov job `cmpyzoc7500039jwcbu1ii4o7` found 9/changed 9.
- `bpc-157-injury-healing` run results: PubMed job `cmpyzsq7p00019jfsudpodgx6` found 0/changed 0; ClinicalTrials.gov job `cmpyzsq7t00039jfs9pvuqz6p` found 0/changed 0.
- Pending backlog: 50 candidates; PubMed AU 20 and ClinicalTrials.gov AU 30.
- Read-only jobs smoke showed recent job rows with candidates/context-jobs/status-jobs hints without writes.
- Read-only summary smoke showed next-command hints after counts without writes.
- Read-only summary smoke still returned curation handoff `total=0`; non-empty curation bucket filter hints are covered by exact output tests.
- Read-only detail smoke for repeated PMID `42141930` showed packet/reference/sibling/group/curation hints without writes.
- Read-only reference-match smoke for repeated PMID `42141930` showed packet/group-list hints and draft-only reference context without writes.
- Read-only curation status/draft smoke for repeated PMID `42141930` showed packet/reference/group/paired-curation hints without writes.
- Read-only curation handoff smoke returned `total=0`; non-empty handoff row hints are covered by exact output tests.
- Read-only review overview smoke returned 9 pending groups across 50 candidates; the `creatine-strength` PubMed top identity showed `topIdentityCandidates=2` and a duplicate-list hint for PMID `42141930`.
- Read-only sibling smoke for repeated PMID `42141930` showed packet hints on each sibling row without writes.
- All current seeded claim-scoped source jobs have been queued and run. `psyllium` is seeded as an intervention but has no seeded claim.
- New `creatine-lifespan` candidate: `NCT07451496`, triage 80/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBsb25nZXZpdHklMjBtb3J0YWxpdHklMjBsaWZlc3BhbnxuY3QwNzQ1MTQ5NnxjcmVhdGluZXxjcmVhdGluZS1saWZlc3Bhbg`; review packet showed no accepted-reference match and no siblings.
- Top `vitamin-d-deficiency` candidate: `NCT00715676`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`; review packet showed no accepted-reference match and 9 same-query siblings.
- `vitamin-d-deficiency` query was broad (`Vitamin D safety adverse effects`); claim-scoped lists include some likely off-target titles despite high triage scores.
- Top `omega-3-triglycerides` candidate: `NCT00435045`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBsaXBpZHMlMjB0cmlnbHljZXJpZGVzJTIwYXBvYiUyMHRyaWdseWNlcmlkZSUyMGxvd2VyaW5nfG5jdDAwNDM1MDQ1fG9tZWdhLTN8b21lZ2EtMy10cmlnbHljZXJpZGVz`; review packet showed no accepted-reference match and 4 same-query siblings.
- Top `omega-3-cv-events` ClinicalTrials.gov candidate: `NCT01492361`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBjYXJkaW92YXNjdWxhciUyMGV2ZW50cyUyMHByZXZlbnRpb258bmN0MDE0OTIzNjF8b21lZ2EtM3xvbWVnYS0zLWN2LWV2ZW50cw`; review packet showed no accepted-reference match and 8 same-query siblings.
- Top `omega-3-cv-events` PubMed candidate: PMID `32634581`, triage 80/100, key `b64:cHVibWVkfGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBjYXJkaW92YXNjdWxhciUyMGV2ZW50cyUyMHByZXZlbnRpb24lMjByYW5kb21pemVkJTIwdHJpYWwlMjBzeXN0ZW1hdGljJTIwcmV2aWV3fDMyNjM0NTgxfG9tZWdhLTN8b21lZ2EtMy1jdi1ldmVudHM`; review packet showed no accepted-reference match and 4 same-query siblings.
- Read-only `omega-3-cv-events` PubMed list smoke showed packet hints on each candidate row.
- Duplicate scan currently shows one pending PubMed identity group for PMID `42141930`; output includes copyable duplicate-list and packet hints.
- Curation handoff: 0 accepted candidates ready for next curation status buckets.
- Useful current view: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.

Latest local validation:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --jobs --jobs-limit 3`
- `npm run ingest:sources -- --candidate-detail b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --summary`
- `npm run ingest:sources -- --candidate-curation-handoff`
- `npm run ingest:sources -- --candidate-curation-status b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --candidate-curation-draft b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --candidate-reference-matches b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --candidate-siblings b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --candidate-review-packet b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
- `npm run ingest:sources -- --candidates --candidate-claim-id omega-3-cv-events --candidate-intervention-id omega-3 --candidate-region AU --candidate-source pubmed --candidates-limit 3`
- `npm run test -- src/lib/data/source-candidates.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 3`
- `npm run ingest:sources -- --candidate-review-packet b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBjYXJkaW92YXNjdWxhciUyMGV2ZW50cyUyMHByZXZlbnRpb258bmN0MDE0OTIzNjF8b21lZ2EtM3xvbWVnYS0zLWN2LWV2ZW50cw`
- `npm run ingest:sources -- --candidates --candidate-claim-id omega-3-cv-events --candidate-intervention-id omega-3 --candidate-region AU --candidate-source clinical-trials --candidates-limit 2`
- `npm run ingest:sources -- --candidates --candidate-duplicates`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Start with read-only review packets and duplicate identity context; do not accept/reject without human review.
- Treat existing `vitamin-d-deficiency` results as broad-query leads; review carefully before any accept/reject decision.
- Queue claim-scoped sources only after new seeded claims are added or a claim needs an intentional re-query.
- Keep peptide/regulatory guardrails explicit and do not add sourcing, dosing, route, or self-administration guidance.
- Keep public promotion manual: accepted candidates still need curated references, claim links, and structured study extraction.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
