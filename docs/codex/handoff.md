# Thread Handoff

Refreshed on 2026-06-04 after consolidating source-candidate drill-in command hint formatting. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

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
- Source-candidate help text describes read-only review/curation drill-ins for candidate, overview, flag, sibling, duplicate, packet, and reference-match views.
- Source-candidate packet/reference/sibling/curation drill-in hints now share one local formatter helper across detail, packet, curation, reference-match, sibling row, duplicate, overview, flag, queue, and summary outputs; exact CLI output remains preserved.
- Summary output is read-only and prints next-command hints for overview, review flags, duplicate scan, queued jobs, and curation handoff; non-empty curation status bucket rows include filtered handoff hints, and the bounded review flag focus block counts flagged top review groups with list/packet/reference-match/sibling/curation/flags/overview drill-ins.
- Job rows are read-only and print candidate-list, context-jobs, and status-jobs hints.
- Queue/run result rows print read-only candidate-list, context-jobs, and status-jobs follow-ups; exact output tests cover these write-result surfaces without live write smokes.
- Review overview is read-only and prints region-qualified `list="..."` filtered queue hints, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, and curation-status/draft top-candidate hints, duplicate hints when the top identity repeats, and compact `topReviewFlags` plus `flags="..."` drill-ins when applicable.
- Review flags view is read-only (`--candidate-review-flags`) and filters the bounded review overview to flagged top candidates only; it can narrow by `--candidate-review-flag broad-safety-query` or `--candidate-review-flag low-title-query-overlap`, with compact `flags`, duplicate hints, `list="..."`, `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, and `overview="..."`.
- Generic and filtered review-flag command hints share one formatter; exact output is unchanged.
- Candidate detail output is read-only and prints packet, reference-match, sibling, group-list, curation-status, curation-draft hints, compact `reviewFlags` plus `flags="..."` drill-ins, and explanatory `reviewCautions` for flagged claim-scoped candidates.
- Candidate list rows are read-only and print `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, query, ingestion-job trace fields, and compact `reviewFlags` plus `flags="..."` drill-ins when applicable.
- Reference-match headings print read-only `packet="..."`, `siblings="..."`, `groupList="..."`, curation-status/draft hints, and compact `reviewFlags` plus `flags="..."` drill-ins when applicable; reference drafts remain draft-only.
- Review packets print safe read-only follow-up commands, curation-status/draft hints, duplicate hints when the identity repeats, review-flag hints when the candidate is flagged, and explicit human-reviewed accept/reject templates.
- Sibling headings print read-only `targetPacket="..."`, `targetReferenceMatches="..."`, and target curation-status/draft hints, and sibling rows print `packet="..."`, `referenceMatches="..."`, and curation-status/draft hints plus compact `targetReviewFlags`/`reviewFlags` and `flags="..."` drill-ins when applicable.
- Duplicate identity output prints read-only `identityList="..."`, per-candidate `packet="..."`, `referenceMatches="..."`, `siblings="..."`, curation-status/draft hints, and compact `reviewFlags` plus `flags="..."` drill-ins when applicable.
- Curation handoff rows print read-only packet, reference-match, sibling, curation-status, curation-draft hints, and compact `reviewFlags` plus `flags="..."` drill-ins when applicable.
- Curation status and draft output print read-only packet, reference-match, sibling, group-list, paired curation-view hints, and compact `reviewFlags` plus `flags="..."` drill-ins when applicable.
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
- Queue/run result hints are covered by exact output tests; live validation used read-only jobs/help only.
- Read-only candidate list smoke for job `cmpyzoc7500039jwcbu1ii4o7` showed packet/reference-match/sibling and curation-status/draft hints plus query and ingestion-job trace fields without writes.
- Read-only summary smoke showed next-command hints and review flag focus counts after counts without writes.
- Read-only summary smoke still returned curation handoff `total=0`; non-empty curation bucket filter hints are covered by exact output tests.
- Read-only detail smoke for repeated PMID `42141930` showed packet/reference/sibling/group/curation hints without writes.
- Read-only reference-match smoke for repeated PMID `42141930` showed packet/sibling/group-list hints and draft-only reference context without writes.
- Read-only curation status/draft smoke for repeated PMID `42141930` showed packet/reference/sibling/group/paired-curation hints without writes.
- Read-only curation handoff smoke returned `total=0`; non-empty handoff row hints are covered by exact output tests.
- Read-only review overview smoke returned 9 pending groups across 50 candidates; the `creatine-strength` PubMed top identity showed `topIdentityCandidates=2` and a duplicate-list hint for PMID `42141930`.
- Read-only review overview smoke showed packet/reference-match/sibling hints plus `topReviewFlags="broad-safety-query"` and `flags="..."` drill-ins on broad `vitamin-d-deficiency` ClinicalTrials.gov and PubMed groups; omega-3 triglycerides did not carry a low-overlap flag after token-root overlap handling.
- Read-only `NCT00715676` review packet smoke showed curation-status/draft hints plus `reviewFlags="--candidate-review-flags --candidate-review-flags-limit 10"` in the top safe command hints without writes.
- Read-only `NCT00715676` detail smoke showed compact `reviewFlags="broad-safety-query"` plus `flags="..."` and explanatory `reviewCautions` with no writes.
- Read-only candidate list smoke for the top `vitamin-d-deficiency` ClinicalTrials.gov rows showed packet/reference-match/sibling and curation-status/draft hints, compact `reviewFlags="broad-safety-query"` plus `flags="..."` drill-ins, and no writes.
- Read-only `NCT00715676` sibling smoke showed `targetPacket`, `targetReferenceMatches`, target curation-status/draft, `targetReviewFlags`, and `flags="..."` on the heading plus row-level `referenceMatches`, curation-status/draft, `reviewFlags`, and `flags="..."`, including low-title-query-overlap prompts for disconnected sibling titles.
- Exact output tests cover `reviewFlags` plus `flags="..."` drill-ins on sibling headings/rows, duplicate identity rows, accepted-reference match headings, curation status, curation draft, and non-empty curation handoff rows; helper consolidation preserved the same output, and no live duplicate write smoke was needed.
- Read-only `NCT00715676` reference-match smoke showed curation-status/draft hints, compact `reviewFlags="broad-safety-query"` plus a `flags="..."` drill-in without writes; paired curation-status/draft smokes remained read-only.
- Read-only curation handoff smoke still returned `total=0`; non-empty flagged handoff drill-ins are covered by exact output tests.
- Read-only summary smoke showed `flag="broad-safety-query"` with 2 top groups / 20 pending in top groups and `flag="low-title-query-overlap"` with 1 top group / 1 pending in top groups; each flag row included `list`, `packet`, `referenceMatches`, `siblings`, curation-status/draft, and `overview` drill-ins.
- Read-only review flags smoke showed 3 flagged top groups: vitamin-d-deficiency ClinicalTrials.gov and PubMed broad-safety-query groups plus the creatine-lifespan ClinicalTrials.gov low-title-query-overlap group.
- Read-only filtered review flags smoke for `broad-safety-query` showed only the two vitamin-d-deficiency broad-query top groups; each row now includes `referenceMatches="..."`, `siblings="..."`, curation-status/draft, and `overview="..."`, summary rows include filtered `flags="..."` drill-ins, and the summary footer includes the generic `reviewFlags="--candidate-review-flags --candidate-review-flags-limit 10"` hint.
- Read-only sibling smoke for repeated PMID `42141930` showed packet, reference-match, and curation-status/draft hints on each sibling row without writes.
- All current seeded claim-scoped source jobs have been queued and run. `psyllium` is seeded as an intervention but has no seeded claim.
- New `creatine-lifespan` candidate: `NCT07451496`, triage 80/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBsb25nZXZpdHklMjBtb3J0YWxpdHklMjBsaWZlc3BhbnxuY3QwNzQ1MTQ5NnxjcmVhdGluZXxjcmVhdGluZS1saWZlc3Bhbg`; review packet showed no accepted-reference match and no siblings.
- Top `vitamin-d-deficiency` candidate: `NCT00715676`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`; review packet showed no accepted-reference match and 9 same-query siblings.
- `vitamin-d-deficiency` query was broad (`Vitamin D safety adverse effects`); claim-scoped lists include some likely off-target titles despite high triage scores.
- Top `omega-3-triglycerides` candidate: `NCT00435045`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBsaXBpZHMlMjB0cmlnbHljZXJpZGVzJTIwYXBvYiUyMHRyaWdseWNlcmlkZSUyMGxvd2VyaW5nfG5jdDAwNDM1MDQ1fG9tZWdhLTN8b21lZ2EtMy10cmlnbHljZXJpZGVz`; review packet showed no accepted-reference match and 4 same-query siblings.
- Top `omega-3-cv-events` ClinicalTrials.gov candidate: `NCT01492361`, triage 100/100, key `b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBjYXJkaW92YXNjdWxhciUyMGV2ZW50cyUyMHByZXZlbnRpb258bmN0MDE0OTIzNjF8b21lZ2EtM3xvbWVnYS0zLWN2LWV2ZW50cw`; review packet showed no accepted-reference match and 8 same-query siblings.
- Top `omega-3-cv-events` PubMed candidate: PMID `32634581`, triage 80/100, key `b64:cHVibWVkfGF1fG9tZWdhLTMlMjBlcGElMkZkaGElMjBjYXJkaW92YXNjdWxhciUyMGV2ZW50cyUyMHByZXZlbnRpb24lMjByYW5kb21pemVkJTIwdHJpYWwlMjBzeXN0ZW1hdGljJTIwcmV2aWV3fDMyNjM0NTgxfG9tZWdhLTN8b21lZ2EtMy1jdi1ldmVudHM`; review packet showed no accepted-reference match and 4 same-query siblings.
- Read-only `omega-3-cv-events` PubMed list smoke showed packet/reference/sibling and curation-status/draft hints on each candidate row.
- Duplicate scan currently shows one pending PubMed identity group for PMID `42141930`; output includes copyable duplicate-list, packet, reference-match, sibling, and curation-status/draft hints.
- Curation handoff: 0 accepted candidates ready for next curation status buckets.
- Useful current views: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`, `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`, and `npm run ingest:sources -- --candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10`.

Latest local validation:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 3`
- `npm run ingest:sources -- --candidates --candidate-job-id cmpyzoc7500039jwcbu1ii4o7 --candidates-limit 3`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warning for `src/lib/data/source-candidate-job-command.ts`)
- `npm run ingest:sources -- --candidate-review-packet b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-detail b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-reference-matches b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-curation-status b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-curation-draft b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-curation-handoff`
- `npm run ingest:sources -- --candidate-siblings b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5 --candidate-siblings-limit 5`
- `npm run ingest:sources -- --candidates --candidate-duplicates`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings)
- `npm run ingest:sources -- --candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 3`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`
- `npm run ingest:sources -- --summary`
- `npm run ingest:sources -- --candidate-review-flags --candidate-review-flag broad-safety-query --candidate-review-flags-limit 10`
- `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`
- `npm run ingest:sources -- --candidates --candidate-job-id cmpyzoc7500039jwcbu1ii4o7 --candidates-limit 3`
- `npm run ingest:sources -- --jobs --jobs-limit 2`
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
- `npm run ingest:sources -- --candidate-review-packet b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-reference-matches b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-curation-status b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidate-curation-draft b64:Y2xpbmljYWx0cmlhbHMuZ292fGF1fHZpdGFtaW4lMjBkJTIwc2FmZXR5JTIwYWR2ZXJzZSUyMGVmZmVjdHN8bmN0MDA3MTU2NzZ8dml0YW1pbi1kfHZpdGFtaW4tZC1kZWZpY2llbmN5`
- `npm run ingest:sources -- --candidates --candidate-claim-id vitamin-d-deficiency --candidate-intervention-id vitamin-d --candidate-region AU --candidate-source clinical-trials --candidates-limit 3`
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
