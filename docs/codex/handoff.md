# Thread Handoff

Refreshed on 2026-06-04 after adding exact duplicate-row source-candidate group-list hints. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

## Startup Scope

- Normal startup: read `AGENTS.md` and `docs/codex/project.md`.
- Read this file only when resuming current work or needing current operator state.
- Open `docs/codex/source-candidate-workflow.md` only for ingestion or curation work.
- Do not read archives wholesale; search them only for targeted history.

## Current Checkpoint

- Branch: `codex/queue-claim-sources`; verify latest commit with `git log -1 --oneline`.
- App shape: public read-only Next.js evidence dashboard with Prisma/PostgreSQL and seed fallback.
- Default lens: Australia/TGA; do not imply ARTG/AUST status without product-level evidence.
- Source-candidate ingestion/review remains local operator-only under `npm run ingest:sources`.
- Public routes stay read-only and must not import source-candidate persistence or promote source candidates.
- Source-candidate acceptance, claim linking, and study extraction stay explicit human-reviewed local writes; accepted candidates still need curated references, claim links, and structured study extraction before public use.
- Source-candidate CLI output now provides copyable read-only review/curation drill-ins across summary, jobs, queues, detail, packets, reference matches, siblings, duplicates, and curation views; see `docs/codex/source-candidate-workflow.md` for the compact catalog.
- Packet/reference/sibling/curation drill-in hints share one local formatter helper in `src/lib/data/source-candidate-job-command.ts`; exact CLI output is covered by source-candidate command tests.
- Candidate filters support read-only `--candidate-claim-missing` and `--candidate-intervention-missing`; generated list hints use them when a group or candidate lacks claim/intervention context.
- Duplicate identity candidate rows include exact read-only `groupList="..."` hints so repeated PMID/NCT identities can be reviewed in their scoped or unscoped context.
- Claim-scoped source queries append compact claim-text anchors after outcome terms before queueing.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

- Last local snapshot: 15 ingestion jobs total, 0 queued jobs, 50 pending candidates, and curation handoff `total=0`.
- Pending backlog split: PubMed AU 20 and ClinicalTrials.gov AU 30.
- All current seeded claim-scoped source jobs have been queued and run. `psyllium` is seeded as an intervention but has no seeded claim.
- Review overview currently has 9 pending groups. Useful entry point: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
- Review flags currently show 3 flagged top groups: two broad `vitamin-d-deficiency` safety-query groups and one `creatine-lifespan` low-title-overlap group. Useful focus command: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`.
- Duplicate scan currently shows one pending PubMed identity group for PMID `42141930`. Useful command: `npm run ingest:sources -- --candidates --candidate-duplicates`.
- Treat `vitamin-d-deficiency` results as broad-query leads; review title, population, outcomes, source identity, siblings, and reference matches carefully before any accept/reject decision.
- Notable current groups: `creatine-lifespan` has one ClinicalTrials.gov lead (`NCT07451496`); `omega-3-triglycerides` has ClinicalTrials.gov leads; `omega-3-cv-events` has PubMed and ClinicalTrials.gov leads. Regenerate exact packet keys from the overview or candidate lists.

## Latest Local Validation

Current code validation for duplicate identity group-list hints:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidates --candidate-duplicates`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Previous docs compaction check:
- `(Get-Content docs/codex/handoff.md).Count` returned 60.
- Guardrail search confirmed local-only review, public read-only, human-reviewed writes, no accept/reject without review, peptide guardrails, workflow doc pointer, and historical archive pointer remain present.
- `git diff --check` (only LF-to-CRLF warning for `docs/codex/handoff.md`).

Previous code validation for source-candidate drill-in formatter consolidation:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 3`
- `npm run ingest:sources -- --candidates --candidate-job-id cmpyzoc7500039jwcbu1ii4o7 --candidates-limit 3`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warning for `src/lib/data/source-candidate-job-command.ts`)

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Start with read-only review packets and duplicate identity context; do not accept/reject without human review.
- Queue claim-scoped sources only after new seeded claims are added or a claim needs an intentional re-query.
- Keep peptide/regulatory guardrails explicit and do not add sourcing, dosing, route, or self-administration guidance.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
