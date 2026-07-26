# Pipeline automation plan

Decided 2026-07-27. Goal: run discovery → published brief with no human in the loop, without
labelling machine output as human-reviewed.

Two decisions are already made and are not open questions:

- **An LLM stage is in scope.** Anthropic SDK (`@anthropic-ai/sdk`), Batch API, `ANTHROPIC_API_KEY`
  in `.env`. Opus 5 (`claude-opus-5`) for claim synthesis, a cheaper tier for mechanical field
  extraction. Full backfill is roughly $8–39 one-off at 50% batch pricing; incremental runs are cents.
- **`AI reviewed` becomes a real review status.** New `ReviewStatus` enum value, Prisma migration,
  automation stamps it instead of `HUMAN_REVIEWED`. Existing mislabelled rows get corrected.

## Already done

- **Score laundering closed.** `buildClaimScoreSuggestion` now returns `blockedReason` for pipeline
  and watchlist rows (`src/lib/score-suggestions.ts`), `buildScoreUpdateDraft` throws on a blocked
  suggestion, and `runLocalScoreFinalization` filters those rows out into a `skippedUnscorable`
  count rather than scoring them. This was the bug that let a placeholder claim linked to 19
  meta-analyses render as "Score 7.5 · Moderate".
- **Reader model.** `src/lib/evidence-brief.ts` classifies every claim as
  `conclusion` / `safety-context` / `pipeline` / `watchlist`, and both the supplement page and the
  dashboard index read from it.
- **Study-design misclassification.** `studyTypeFromCandidate` no longer promotes a bare
  "clinical trial" signal to `RANDOMIZED_CONTROLLED_TRIAL` (rigor 8) — that now requires actual
  randomization wording and otherwise resolves to `CLINICAL_TRIAL_RECORD` (rigor 5). The no-match
  fallback moved off `SYSTEMATIC_REVIEW` (rigor 8) to `CASE_REPORT` (rigor 2).
- **Sections 0, 1 and 2 below are now done** (2026-07-27). See "Landed" at the end of this file for
  what shipped, what changed relative to the plan, and the open questions.

## Work remaining

### 0. Fold `StudyType.UNCLASSIFIED` into the same migration

`CASE_REPORT` is a stopgap for the no-match fallback, not the right answer. It stops the rigor
inflation, but it is still a false factual claim — "a single unreplicated observation" — and it
reaches readers, because `summarizeStudyMix` in `evidence-brief.ts` renders study design on the
public page. An unclassifiable source will show up as "1 case report".

The enum has no "unknown" member, which is the only reason the stopgap exists. Since section 1
already requires a Prisma migration, add `UNCLASSIFIED` to `StudyType` in the same one: give it
rigor 0 in `studyRigorScores`, keep it out of `directHumanStudyTypes`, map it in
`sourceTypeTaxonomyFromDbStudy`, and have `readerStudyType` render it as "design not established"
rather than naming a design. Then switch the fallback off `CASE_REPORT`.

While there: `src/lib/study-source-type-hints.ts:51` has the same bare-"clinical trial" → RCT
mapping. It was left alone because it only renders a curator-facing hint string
(`score-extraction-preview.ts`, `scripts/local-score-worklist.ts`) and never feeds
`studyRigorScores`, so it misleads a human rather than inflating a stored score. Worth fixing in
the same pass for consistency; its no-match path already returns `undefined`, which is correct.

### 1. `AI reviewed` review status

Add `AI_REVIEWED` to the `ReviewStatus` enum in `prisma/schema.prisma` and to `ReviewStatus` in
`src/lib/types.ts`, plus the mapper in `src/lib/data/dashboard.ts`. About 91 files reference
`ReviewStatus`; most only compare against `"Human reviewed"` and keep working, but every
`reviewStatus === "Unreviewed AI draft"` check needs auditing — several are really asking
"has anyone looked at this", which is now a three-way question.

The write that matters is `src/lib/data/source-candidates.ts:1240`, which hardcodes
`reviewStatus: HUMAN_REVIEWED` on every decision including automated ones. Take the status as a
parameter; the CLI path passes human, the automation paths pass AI.

Then a correction pass over the 32,786 rows already stamped `HUMAN_REVIEWED`. Their `reviewNote`
identifies the automated ones exactly — they read "Bulk accepted likely useful candidates from the
one-click local UPDATE pipeline", "Auto-accepted maybe-useful candidate after conservative local
review triage", "Rejected by local identity resolver as wrong supplement", and similar. Prepare it
as a `_tmp_` dry-run script; the user applies with `--apply`.

### 2. Headless pipeline runner

`runLocalUpdatePipeline` in `src/components/evidence-dashboard.tsx:3171` is already an exported
async function taking an injected `operations` object — the logic is headless-capable, only the
wiring is React. Stage 10 (`refresh`) is UI-only and drops out.

Extract the stage logic to `src/lib/pipeline/` and add `scripts/pipeline-run.ts` calling the lib
functions directly rather than over HTTP. Doing so also bypasses `guardLocalIngestionRequest`
(`src/lib/data/local-ingestion-route-guard.ts`), which requires localhost origin headers and so
structurally requires a browser. Keep the API routes as they are — the dashboard button still uses them.

Then a cron. The only existing one (`.github/workflows/scheduled-ingestion-alert-monitor.yml`) runs
`npm run ingest:scheduled-dry-run`, an alias that is not in `package.json`.

### 3. Relevance gate to replace human triage

Do **not** auto-accept on `triageScore`. In the 70–89 band where most accepts live only 55–61% were
actually accepted — the score does not discriminate relevance. 18.9% of accepted candidates never
name their intervention in the title.

Build a gate that runs before the score:

- **Identity.** Intervention name or synonym must appear in title or abstract. The synonym lists are
  too thin — omega-3 misses "n-3 PUFA" and "icosapent ethyl", green tea misses "epigallocatechin
  gallate". Expand these first; a large share of the 18.9% is synonym gaps rather than contamination.
- **Trap terms.** `LOCAL_BENEFIT_DISCOVERY_CONTEXT_RULES` (`local-ingestion-control.ts:384`) already
  handles this pattern for calcium ("coronary artery calcium"). There is no creatine entry despite
  creatinine being the known contamination case. Extend the table.
- **Design.** RCT / SR / MA / registered trial only.
- **Outcome.** Must map to one of the 17 `OutcomeArea` values.

Anything the gate cannot decide goes to the LLM relevance check rather than to a human.

### 4. LLM extraction and synthesis

The actual bottleneck: 5,876 references have no `Study` row, and no automated path exists from a
placeholder claim to a written conclusion — nothing in `src/` writes `Claim.claimText` after creation.

- **Extraction.** Input is the stored abstract (`SourceCandidate.metadata.sourceText`). Output is a
  structured `Study`: sampleSize, population, dose, duration, mainResults, outcomes, riskOfBias.
  Use strict tool use or `output_config.format` with a JSON schema so the shape is guaranteed.
  Replaces the regex fallbacks in `local-source-work-repair.ts` that currently write prose like
  "Sample size not captured in local metadata".
- **Synthesis.** Input is the packet of extracted studies for one (intervention, outcome). Output is
  a scoped conclusion, the population it applies to, the effect size, the honest uncertainty, and
  what would change it. This is what fills `claimText`, `populationStudied`, `effectSize`,
  `summary`, `uncertainty`.
- Batch API for both. Results arrive in any order — key by `custom_id`, never by position.
- Everything written this way is stamped `AI reviewed`, never `Human reviewed`.
- The guardrails in AGENTS.md are prompt-level requirements, not optional: citation traceability,
  uncertainty labels, AU/TGA caveats, product-level boundaries, and no peptide sourcing, dosing,
  reconstitution or self-administration guidance.

### 5. Recompute `confidenceLevel`

`src/lib/data/score-update.ts` writes ten score fields and never touches `confidenceLevel`. It is
set once at claim creation as `VERY_LOW` and frozen, which is why 687 of 704 claims sit there and
nothing ever tiers up — while the public page reads it in five places. Derive it in the same pass
that writes scores, from packet completeness, study design mix, and count.

## Order

1. `AI reviewed` enum + `StudyType.UNCLASSIFIED` in one migration, and stop the mislabelling
   (unblocks everything else being honest)
2. Headless runner + cron
3. Synonym expansion and the relevance gate
4. LLM extraction, then LLM synthesis
5. `confidenceLevel` recomputation

Each stage must stay idempotent and resumable, and DB writes stay dry-run-first.

## Landed — 2026-07-27 (sections 0 and 1)

### Migration history had drifted

`prisma migrate dev` refused to run and offered to reset the database. The local dev DB was ahead
of this branch: `20260613193000_trial_alerts` and `20260616120000_ai_review_status` were applied but
absent from `prisma/migrations/`. Both live on `origin/cursor/cloud-agent-1782299624963-tz4p5`
(commit `7e29bcb`), which is not an ancestor of `codex/queue-claim-sources`.

So `ReviewStatus.AI_REVIEWED` **already existed in the database** — the plan's premise for section 1
was stale. `ReviewEventType.AI_REVIEWED` existed too, which the plan did not mention.

Resolved by absorbing both migrations into this branch and porting the schema delta (`TrialAlert`
model, `TrialAlertKind`, `TrialAlertStatus`, six back-relation lines). Then one new migration,
`20260726143914_unclassified_study_type`, added `StudyType.UNCLASSIFIED`. No reset, no data loss.
`TrialAlert` is now carried by this branch although nothing in `src/` uses it yet.

### `StudyType.UNCLASSIFIED`

Rigor **0** in `studyRigorScores` — deliberately the only zero, so `strongestLinkedStudy` sorts it
last. Excluded from `directHumanStudyTypes`. Reader-facing label is **"study of unclear design"**,
not the plan's "design not established": `readerStudyType` output is always consumed inside a count
("3 studies of unclear design"), and the plan's wording does not pluralise. `pluralizeStudyType`
gained an irregular-plural table for it. The `local-source-work-repair.ts` fallback now returns
`UNCLASSIFIED` instead of `CASE_REPORT`.

`study-source-type-hints.ts` was fixed in the same pass: a bare "clinical trial" now resolves to
`clinical-trial-record`, not `randomized-controlled-trial`.

### `ReviewStatus` is three-way

New module `src/lib/review-status.ts` holds the mapping plus two named predicates, because the old
binary comparison was being used to ask two different questions:

- `hasBeenReviewed` — "has anyone looked at this", now satisfied by AI review
- `isHumanConfirmed` — "did a human sign off", never satisfied by automation

Both reader-facing checks on the intervention page were classified rather than mechanically
converted. `readerOverallConfidence` (page.tsx:874) now requires `isHumanConfirmed` — it drives the
site's strongest confidence badge, and letting AI review raise it is exactly the laundering this
work exists to stop. The synthesis fallback (page.tsx:4027) uses `hasBeenReviewed`, so an
AI-written summary will display rather than hide. **Labelling that summary as machine-written is
section 4's job and is not done yet.**

`recordSourceCandidateDecision` takes a required `reviewedBy: "human" | "automation"`. Required and
undefaulted on purpose — the old hardcoded `HUMAN_REVIEWED` is why the data is wrong. For
`recordLocalCandidateReviewDecision` it is a separate argument rather than an input field, because
that input is an unvalidated request body and a client must not be able to claim human confirmation.
Single dashboard click and the CLI pass `"human"`; every bulk, auto-triage, and catalog-script path
passes `"automation"`.

The methodology page now documents `AI reviewed` and the unclear-design tier to readers.

### The correction pass is written but NOT applied

`scripts/_tmp_correct_mislabelled_human_reviewed.ts`, dry-run by default, apply with `--apply`.

Dry run against 32,786 `HUMAN_REVIEWED` SourceCandidate rows: **32,781 would become `AI_REVIEWED`,
5 stay.** The plan's expected notes all appear, plus two the plan did not list — the
`(hobby-project mode)` note shared by the three `local-db-catalog-*` triage scripts, and 15 notes
that literally begin `"AI reviewed:"`.

**Adjudicated 2026-07-27.** 2 rows read "Codex confirmed all listed AI recommendations in the
Operator Review Queue." Asked whether a person drove that, the user did not recall doing so — so
there is no evidence a human confirmed them. An unremembered confirmation is not a confirmation, and
`HUMAN_REVIEWED` has to mean exactly what it says, so the fragment moved into
`AUTOMATED_NOTE_FRAGMENTS`. **32,783 now change; 3 stay.** The rows are not lost — they can be
re-reviewed for real, which is why downgrading is the cheap direction to be wrong in.
`AMBIGUOUS_NOTE_FRAGMENTS` stays in the script, now empty, so a future unvouchable note pattern
still has somewhere to land instead of defaulting into a status it has not earned.

The other six models carrying `reviewStatus` (Claim 19, SourcePacket 74, ClaimScoreSnapshot 129,
ReviewEvent 174, Product 0, SourceDocument 0) are reported by the script but never touched — they
have no `reviewNote` to adjudicate.

Verified: 885 tests pass across 106 files, `typecheck:tsc` clean, `git diff --check` clean,
methodology page renders both new strings.

## Landed — 2026-07-27 (section 2, headless runner)

`runLocalUpdatePipeline` moved out of `evidence-dashboard.tsx` into `src/lib/pipeline/`:

- `types.ts` — stage definitions, settings, and the `LocalUpdatePipelineOperations` seam
- `messages.ts` — the pure log/detail formatters, so a headless run emits log lines identical to
  the on-screen ones
- `run-local-update-pipeline.ts` — the runner, moved verbatim
- `direct-operations.ts` — `LocalUpdatePipelineOperations` implemented against the data layer
  in-process, bypassing `guardLocalIngestionRequest`

`operations` is now **required** rather than defaulting. The default was the HTTP implementation;
leaving it in the lib would have quietly reintroduced the browser dependency. The dashboard passes
`defaultLocalUpdatePipelineOperations()` explicitly and re-exports `runLocalUpdatePipeline`, so
existing importers are unaffected. `evidence-dashboard.tsx` dropped from 12,572 to 10,715 lines.

Entry point is `scripts/pipeline-run.ts` (`npm run pipeline:run`), with `--max-jobs`,
`--run-delay-ms`, `--lead-threshold`, `--reject-threshold`, `--quiet`. It refuses a reject threshold
at or above the lead threshold, exits 130 on interrupt (first Ctrl-C stops at a stage boundary), and
exits 1 if any stage reported row-level errors so a scheduler sees the failure. There is
deliberately no dry-run flag — every stage of this pipeline writes.

**Deviation from the plan:** the `refresh` stage was kept rather than dropped. The plan called it
UI-only, but its body is three status reads that produce the run's closing summary — the most useful
line in an unattended log. Nothing in it touches the DOM.

### The cron cannot be hosted

The plan said "then a cron", and the broken alias is fixed: `ingest:scheduled-dry-run` now exists
(`tsx scripts/scheduled-source-ingestion.ts`), so `.github/workflows/scheduled-ingestion-alert-monitor.yml`
stops failing every 30 minutes on a missing script. Verified: exits 0.

But the pipeline itself **cannot** run on GitHub Actions. It writes to the local PostgreSQL on the
dev machine; a hosted runner gets an empty ephemeral database, writes to it, and discards the
result. So the schedule has to be local: `scripts/register-pipeline-schedule.ps1` registers a
Windows scheduled task (supports `-WhatIf`, logs to `logs/pipeline-run.log`).

**Registered 2026-07-27** at the user's explicit instruction: task `Apex Lifespan pipeline`, daily
03:00 local, `--max-jobs 100 --quiet`, appending to `logs/pipeline-run.log`.

It was registered **before** section 3, so every unattended run until the relevance gate lands uses
the current triage — the one measured at 55–61% precision in the 70–89 band. Expect the accepted
candidate pool to grow faster than its quality. Section 3 is the fix; until then, read the log.

```powershell
Unregister-ScheduledTask -TaskName "Apex Lifespan pipeline" -Confirm:$false
```

### Open: a type assertion that hides source-kind drift

Building `direct-operations.ts` surfaced this. `@/components/local-ingestion/types` narrows `source`
to `LocalIngestionSource = "PUBMED" | "CLINICALTRIALS_GOV"`, while the data layer returns Prisma's
full 9-member `SourceKind`. The routes reshape nothing — the narrowing was only ever an unchecked
`as T` inside the dashboard's `localIngestionFetch`, so the component types were never verified
against the data layer.

It is runtime-true today because `LOCAL_SUPPORTED_SOURCES` restricts local-ingestion queries to
those two. `direct-operations.ts` reproduces the assertion through a mapped type that rewrites only
`SourceKind` and leaves everything else structurally checked — which confirmed `source` is the sole
mismatch. The real fix is for `local-ingestion-control.ts` to type these fields as the narrow union
at source; until then a third local source kind would break both paths with no compile error.
