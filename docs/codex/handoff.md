# Thread Handoff

Resume-only snapshot. Do not load during ordinary startup.

## Current State

- Repo: Apex Lifespan checkout
- Branch: `codex/queue-claim-sources`, tracking `origin/codex/queue-claim-sources`; ahead 106, behind 0 at `81e330f`.
- Source of truth for development: local PostgreSQL with `APEX_DATA_SOURCE=database`
- Worktree: 59 modified tracked paths, 37 untracked paths, and 2 staged additions (the two restored migration folders — see "Migration history" below). Preserve everything; do not clean, revert, stage, commit, push, or delete anything unless explicitly asked.
- Verify live catalog counts from the local dashboard or `npx tsx scripts/db-inventory.ts`; do not trust old handoff metrics.
- Last verified local DB inventory: 54 interventions / 745 claims.
- There is an untracked zero-byte file named `{`; leave it alone unless the user explicitly approves cleanup.

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

**Section 3 of `docs/codex/pipeline-automation-plan.md`** — synonym expansion, then the relevance gate. Sections 0, 1 and 2 shipped on 2026-07-27; the plan's "Landed" sections record what changed relative to what it originally said, including two places where the plan's premise turned out to be stale. Read those before starting.

The section-3 trap is already documented and is the whole point of that section: do **not** auto-accept on `triageScore`. In the 70–89 band where most accepts live only 55–61% were actually accepted, so the score does not discriminate relevance. Expand synonyms first (omega-3 misses "n-3 PUFA" and "icosapent ethyl"; green tea misses "epigallocatechin gallate"), then gate on identity + trap terms + design + outcome.

## Waiting On The User — Do Not Do These Unasked

Two deliverables from 2026-07-27 are intentionally not applied. Both are the user's call:

- `scripts/_tmp_correct_mislabelled_human_reviewed.ts` — dry-run verified. Would move 32,781 of 32,786 `SourceCandidate` rows from `HUMAN_REVIEWED` to `AI_REVIEWED`. Apply with `--apply`. Two rows are marked `[ASK]` ("Codex confirmed all listed AI recommendations in the Operator Review Queue") and need a human to decide whether that was a person or an agent.
- `scripts/register-pipeline-schedule.ps1` — written, **not registered**. The pipeline cron cannot be hosted: it writes to the local Postgres, so a GitHub Actions runner would only ever write to a throwaway ephemeral database. Registering it creates a standing unattended writer.

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
- Baseline as of 2026-07-27: `npm run test` is **885 passing across 106 files**, `typecheck:tsc` clean, eslint clean. If a run reports fewer, re-run before investigating — running vitest and eslint in one shell invocation produced a one-off 883 with an unhandled-error warning that did not reproduce in three consecutive clean runs.
- The operator dashboard is behind GitHub sign-in, so the UPDATE button cannot be verified in-browser by an agent. `runLocalUpdatePipeline` is covered directly by `src/components/evidence-dashboard.test.tsx`.
- Optimize-Codex checks passed on 2026-07-10: full `git diff --check`, `npm run typecheck:tsc -- --pretty false`, both corrected CLI help commands, and live compact-helper smoke checks.
- If Prisma generation is locked on Windows, stop only the Apex dev server, rerun the check, then restart it.

## Retired From Active Work

- Readiness gates, promotion chains, token-ratio monitoring, launch rehearsals, generated packets, and `.ai/delegation/` logs as backlog or instructions.
