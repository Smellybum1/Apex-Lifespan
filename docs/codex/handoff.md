# Thread Handoff

Resume-only snapshot. Do not load during ordinary startup.

## Current State

- Repo: Apex Lifespan checkout
- Branch: `codex/queue-claim-sources`, tracking `origin/codex/queue-claim-sources`.
- Source of truth for development: local PostgreSQL with `APEX_DATA_SOURCE=database`
- **Worktree is clean as of 2026-07-27.** The 98 uncommitted paths that used to be described here were committed that night in eight commits, `81e330f` → the current tip. Nothing is being held uncommitted any more; the old "preserve everything, do not commit" instruction is obsolete.
- Verify live catalog counts from the local dashboard or `npx tsx scripts/db-inventory.ts`; do not trust old handoff metrics.
- Last verified local DB inventory: 54 interventions / 704 claims / 12,000 accepted candidates / 10,880 pending.
- The stray zero-byte file named `{` was deleted on 2026-07-27.
- **A scheduled task writes to the catalog nightly.** `Apex Lifespan pipeline` runs `npm run pipeline:run` at 03:00 local and appends to `logs/pipeline-run.log`. Remove with `Unregister-ScheduledTask -TaskName "Apex Lifespan pipeline" -Confirm:$false`.

## Active Product Slice

- Local ingestion dashboard/API for PubMed and ClinicalTrials.gov discovery.
- Candidate Review with bulk accept/reject.
- Accepted-candidate processor.
- Benefit Discovery auto-build/preview for conservative local draft claims.
- Pipeline logic now lives in `src/lib/pipeline/` (extracted from `evidence-dashboard.tsx` on 2026-07-27). The dashboard injects HTTP-backed operations and re-exports `runLocalUpdatePipeline`; `npm run pipeline:run` injects in-process ones. `operations` is required, not defaulted — do not re-add a default, it would reintroduce the browser dependency.
- Identity Resolver for wrong/ambiguous supplement matches.
- Evidence map now prioritizes the ranked outcome board, defaults to compact Top 3, and keeps the old coverage matrix collapsed.
- Intervention click-through claim cards now show claim-level plain-language summaries and caution/adverse badges before component score bars.
- Ordinary startup remains `AGENTS.md` + `docs/codex/project.md` only (about 2.2k estimated tokens); workflow and read-first helpers now use compact, bounded defaults.
- Legacy launch/operations/promotion docs are lightweight stubs at their old paths; full text moved under `docs/codex/archive/legacy-workflows/`.

## Recommended Next Task

**Sections 0–3 and 5 of `docs/codex/pipeline-automation-plan.md` all shipped on 2026-07-27.** Read that plan's "Landed" sections before starting anything — they record several places where the plan's own premise turned out to be stale (the extraction input field was named wrong; the biggest identity wins were normalisation bugs, not missing synonyms).

Two candidates, in order:

1. **The `source` type assertion** (documented at the end of the plan). `@/components/local-ingestion/types` narrows `source` to a 2-member union while the data layer returns Prisma's 9-member `SourceKind`; the narrowing is an unchecked cast reproduced by a mapped type in `src/lib/pipeline/direct-operations.ts`. Runtime-true only because `LOCAL_SUPPORTED_SOURCES` restricts queries to those two — a third local source kind breaks both paths with **no compile error**. The fix is to type these fields as the narrow union in `local-ingestion-control.ts`. **Do not start this shortly before 03:00** — it runs through the pipeline's hot path and a mistake would break the unattended run.

2. **Consolidate the two trap-term tables.** `INTERVENTION_TRAP_RULES` in `src/lib/relevance-gate.ts` is keyed by slug and covers creatine; `LOCAL_BENEFIT_DISCOVERY_CONTEXT_RULES` in `local-ingestion-control.ts` encodes the same idea keyed by intervention id, which only resolves for seeded rows. A term added to one does not protect the other.

**Section 4 (LLM extraction and synthesis) is blocked and cannot be started.** `ANTHROPIC_API_KEY` is set in neither `.env` nor `.env.local`, `@anthropic-ai/sdk` is not installed, and the `ant` CLI is absent — so there is no credential of any kind on this machine (checked 2026-07-27, not assumed). The user confirmed they do not have a key. It needs a key, credits, and an explicit spend decision. Estimated ~$18 one-off at batch pricing. This is the only path to clearing the 552 placeholder claims.

## Waiting On The User — Do Not Do These Unasked

Two DB backfills are written, dry-run verified, and intentionally not applied. The agent cannot run them — the auto-mode gate blocks agent-initiated local-DB writes — so both are the user's to run:

- `scripts/_tmp_correct_mislabelled_human_reviewed.ts` — moves **32,783 of 32,786** `SourceCandidate` rows from `HUMAN_REVIEWED` to `AI_REVIEWED`. Apply with `--apply`. The two previously-`[ASK]` rows were adjudicated on 2026-07-27: asked whether a person drove "Codex confirmed all listed AI recommendations", the user did not recall doing so, so they are treated as automated. An unremembered confirmation is not one, and downgrading is the reversible direction.
- `scripts/_tmp_backfill_claim_confidence.ts` — derives `confidenceLevel` from extracted evidence. **15 changes over 704 claims, 12 up and 3 down.** All 552 placeholders correctly stay at the floor. **Read the dry run before applying**, specifically `Whey protein / Mortality/lifespan`, which reaches Moderate off exactly three extracted studies and is the weakest promotion in the set.

`scripts/register-pipeline-schedule.ps1` **was registered** on 2026-07-27 at the user's explicit instruction — see "Current State".

## Migration History — Read Before Running Prisma

The local Postgres is shared across branches, including Cursor cloud-agent branches that are never merged. On 2026-07-27 `prisma migrate dev` found the DB ahead of this branch and offered `prisma migrate reset`, which would have dropped the whole catalog.

That specific drift is closed — `20260613193000_trial_alerts` and `20260616120000_ai_review_status` were restored from `7e29bcb` and the `TrialAlert` model ported into `schema.prisma` — but the shared-DB setup that caused it is unchanged. **Never accept the reset prompt.** Recover instead by locating the missing migrations with `git log --all -- prisma/migrations/<name>`, restoring the files, porting any models the branch lacks, and confirming with `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`.

Prisma client generation fails with `EPERM ... query_engine-windows.dll.node` while the dev server runs. Stop it with `npm run dev:stop -- 3200` (the script defaults to port 3001; the server actually runs on **3200** per `.claude/launch.json`), regenerate, then restart.

## Hard Stops

- Ask before preview/production deploys, preview/production DB changes, migrations, secrets, destructive cleanup, or medical/regulatory boundary changes.
- Use `Human reviewed` only after explicit human confirmation.
- Public routes stay read-only.
- Do not infer product-level ARTG/AUST status from generic intervention evidence.
- Avoid medical advice and peptide operational guidance.

## Next Useful Checks

- Docs-only changes: `git diff --check -- <docs>`
- UI/local ingestion changes: targeted Vitest files where practical, then `npm run typecheck:tsc -- --pretty false` when shared TypeScript changed.
- Current evidence-map/detail checks used recently: `npm run test -- src/components/evidence-dashboard.test.tsx "src/app/interventions/[slug]/page.test.tsx"` and `npm run typecheck:tsc -- --pretty false`.
- Baseline as of 2026-07-27 (end of night): `npm run test` is **938 passing across 109 files**, `typecheck:tsc` clean. If a run reports fewer, re-run before investigating — running vitest and eslint in one shell invocation once produced a one-off short count with an unhandled-error warning that did not reproduce in three consecutive clean runs.
- The scheduled run's output is `logs/pipeline-run.log` (gitignored). Check it before assuming the nightly run worked; a vetoed-candidate count is reported on its own line.
- The operator dashboard is behind GitHub sign-in, so the UPDATE button cannot be verified in-browser by an agent. `runLocalUpdatePipeline` is covered directly by `src/components/evidence-dashboard.test.tsx`.
- Optimize-Codex checks passed on 2026-07-10: full `git diff --check`, `npm run typecheck:tsc -- --pretty false`, both corrected CLI help commands, and live compact-helper smoke checks.
- If Prisma generation is locked on Windows, stop only the Apex dev server, rerun the check, then restart it.

## Retired From Active Work

- Readiness gates, promotion chains, token-ratio monitoring, launch rehearsals, generated packets, and `.ai/delegation/` logs as backlog or instructions.
