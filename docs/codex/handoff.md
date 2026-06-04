# Thread Handoff

Refreshed on 2026-06-04 after accepting the scoped `PMID 42141930` source candidate and improving mixed-decision duplicate identity plus reference/curation review-audit surfacing. Verify local state with `git status -sb` and `git log -1 --oneline` before edits.

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
- `npm run ingest:sources` now prints the read-only summary; queued ingestion runs require explicit `--run-next` or `--job-id`.
- Public routes stay read-only and must not import source-candidate modules/persistence or promote source candidates; boundary tests cover static, dynamic, and CommonJS `source-candidate*` route imports.
- Source-candidate acceptance/rejection, claim linking, and study extraction stay explicit human-reviewed local writes; persistence accepts only accepted/rejected review decisions, accept/reject decisions require human review notes at CLI, type, and persistence layers, rejected decisions cannot carry accepted-reference ids, study extraction preflights required manual fields and explicit source types before DB reads, and accepted candidates still need curated references, claim links, and structured study extraction before public use.
- Source-candidate CLI output now provides copyable read-only review/curation drill-ins and Not-accepted accept-gate hints across summary, jobs, queues, detail, packets, reference matches, siblings, duplicates, and curation views; curation status/draft/handoff rows include accepted-reference/review-note fields for reviewed rows; see `docs/codex/source-candidate-workflow.md` for the compact catalog.
- Packet command hints include accepted-reference match counts and explicit accept-gate booleans; packet/reference/sibling/curation drill-ins share one local formatter helper in `src/lib/data/source-candidate-job-command.ts`, and exact CLI output is covered by source-candidate command tests.
- Candidate filters support read-only `--candidate-claim-missing` and `--candidate-intervention-missing`; generated list hints use them when a group or candidate lacks claim/intervention context.
- Duplicate identity review surfaces include `duplicateCaution` prompts plus exact read-only duplicate/list hints in overview, flags, packets, reference matches, and duplicate rows; accepted-reference/review-note fields for reviewed rows; and explicit `intervention`/`claim` values, including `none`, so repeated PMID/NCT identities can be reviewed in scoped or unscoped context before any decision.
- Duplicate identity scans now surface mixed-decision identities by default, while explicit `--candidate-decision` filters still narrow the scan.
- Review overview top-candidate selection now prefers repeated PMID/NCT identities when triage scores tie, so mixed accepted/pending duplicates are more visible from the overview.
- Flagged summary, overview, and candidate-level rows include caution text plus context-scoped read-only `flagFocus="..."` hints while preserving broader `flags="..."` drill-ins; filtered review-flag rows focus the selected flag.
- Claim-scoped source queries append compact claim-text anchors after outcome terms before queueing.
- Completed 2026-06-04 source-candidate plan files have been moved out of top-level `docs/codex/plans/` into `docs/codex/plans/archive/2026-06-04/`; keep the top-level plans folder for active plans only.
- Local Docker/PostgreSQL setup was verified earlier; migrations and seed were applied locally.

## Current Source-Candidate State

- Last local snapshot: 15 ingestion jobs total, 0 queued jobs, 49 pending candidates, 1 accepted candidate, and curation handoff `total=1`.
- Pending backlog split: PubMed AU 19 and ClinicalTrials.gov AU 30.
- Accepted candidate: scoped PubMed AU `PMID 42141930` for `claim=creatine-strength` / `intervention=creatine`, accepted with `ref-pubmed-42141930` and human review note: "Human reviewed PMID 42141930; relevant to creatine and lean mass/strength outcomes, but needs curated reference before promotion."
- Current curation handoff status for accepted `PMID 42141930`: `Claim link missing`, `publicSourcePacketReady=false`; curation status/draft/handoff show the stored `reviewed` timestamp and human review note, but do not link or extract without explicit human-owned curation.
- All current seeded claim-scoped source jobs have been queued and run. `psyllium` is seeded as an intervention but has no seeded claim.
- Review overview currently has 9 pending groups. Useful entry point: `npm run ingest:sources -- --candidate-review-overview --candidate-review-overview-limit 10`.
- Review flags currently show 3 flagged top groups: two broad `vitamin-d-deficiency` safety-query groups and one `creatine-lifespan` low-title-overlap group. Useful focus command: `npm run ingest:sources -- --candidate-review-flags --candidate-review-flags-limit 10`.
- Duplicate scan currently shows one mixed PubMed identity group for `PMID 42141930`, with one pending unscoped row and one accepted scoped `creatine-strength` row. Useful command: `npm run ingest:sources -- --candidates --candidate-duplicates --candidate-source pubmed --candidate-external-id 42141930 --candidates-limit 2`.
- Review overview now surfaces the pending unscoped `PMID 42141930` row as the top `claim=none`/`intervention=none` PubMed group candidate with `topIdentityCandidates=2`.
- Treat `vitamin-d-deficiency` results as broad-query leads; review title, population, outcomes, source identity, siblings, and reference matches carefully before any accept/reject decision.
- Notable current groups: `creatine-lifespan` has one ClinicalTrials.gov lead (`NCT07451496`); `omega-3-triglycerides` has ClinicalTrials.gov leads; `omega-3-cv-events` has PubMed and ClinicalTrials.gov leads. Regenerate exact packet keys from the overview or candidate lists.

## Latest Local Validation

Current code validation for reference-match duplicate cautions:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-reference-matches <pending unscoped PMID 42141930 key>` (read-only smoke)
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Current code validation for curation review audit fields:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-curation-status <accepted PMID 42141930 key>` (read-only smoke)
- `npm run ingest:sources -- --candidate-curation-draft <accepted PMID 42141930 key>` (read-only smoke)
- `npm run ingest:sources -- --candidate-curation-handoff` (read-only smoke)
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Current closeout validation:
- `npm run ingest:sources -- --summary` (read-only state check)
- `git diff --check`
- Startup/workflow docs and tracked workflow config reviewed; no code changed in closeout.

Current code validation for mixed-decision duplicate identity scans:
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- Read-only CLI smokes for exact `PMID 42141930` duplicate scan and summary.
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Current code validation for duplicate identity audit fields:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- Read-only CLI smoke for exact `PMID 42141930` duplicate scan.

Current code validation for overview duplicate tie-breaks:
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
- Read-only CLI smoke for review overview.
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Current code validation for source-candidate duplicate identity cautions:
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`, `npm run lint`, `npm run dev:stop`, `npm run typecheck`
- Read-only CLI smokes for duplicate packet, duplicate scan, and review overview.
- `git diff --check` (only LF-to-CRLF warnings for modified files)

Recent code validation for source-candidate CLI/type/persistence guardrails:
- Focused source-candidate command/persistence tests plus `npm run test`, `npm run lint`, `npm run dev:stop`, and `npm run typecheck`.

## Next Useful Tasks

- Continue pending source-candidate review in small human-reviewed slices.
- Start with read-only review packets and duplicate identity context; do not accept/reject without human review.
- Queue claim-scoped sources only after new seeded claims are added or a claim needs an intentional re-query.
- Keep peptide/regulatory guardrails explicit and do not add sourcing, dosing, route, or self-administration guidance.

Historical source-candidate progress was moved to `docs/codex/archive/handoff/2026-06-04-source-candidate-progress.md`.
