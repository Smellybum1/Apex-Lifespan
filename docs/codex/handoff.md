# Thread Handoff

Refreshed on 2026-06-21 after friction removal.

## Current State

- Work in `D:\Codex\Apex Lifespan` on branch `codex/queue-claim-sources`.
- Branch is ahead of `origin/codex/queue-claim-sources` by six local commits through `f343960`.
- Worktree is intentionally very dirty. Do not clean, revert, stage, commit, push, or touch unrelated files unless explicitly asked.
- Newest verified local state wins over older notes.

## Current Direction

- Cut bureaucracy. Prefer direct product work over process artifacts.
- The old internal artifact chain and Composer ratio loop are retired from active workflow.
- A Goal 37 Composer attempt failed in an isolated run and its patch was not applied.

## Hard Stops

- Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.
- Use `Human reviewed` only when a human explicitly confirms it.
- Public routes and dashboard surfaces remain read-only.

## Dirty-Tree Cleanup

Snapshot on 2026-06-21: 95 tracked dirty files and 66 untracked paths remain. Tracked top dirs: `src/` 70, `docs/` 13, `scripts/` 5, `prisma/` 2, plus single root/config files. Untracked top dirs: `src/` 37, `scripts/` 13, `docs/` 13, `prisma/` 2, `.ai/` 1.

Friction-removal slice (isolated, not staged or committed): `.agents/skills/project-workflow/SKILL.md`, `.gitignore`, `AGENTS.md`, `docs/codex/handoff.md`, `docs/codex/project.md`, `docs/codex/workflow.md`, `docs/codex/roadmap.md`, `docs/codex/reference/local-operations.md`, `package.json`, `docs/codex/roadmap-completion-audit.md`, `docs/codex/workflows/codex-cursor-composer.md`, `scripts/check-composer-integration.cjs`, and `scripts/composer/`. Narrow checks already passed: `git diff --check` over the slice and trailing-whitespace scan on untracked task-owned files.

Next product-area triage order:
1. `src/` - 70 tracked dirty, 37 untracked. Tracked: `src/lib` 30, `src/lib/operator` 18, `src/lib/data` 9, `src/app` 6, `src/components` 5, `src/lib/integrations` 2. Untracked: `src/lib/operator` 19, `src/lib` 16, `src/lib/data` 2. Sub-batches:
   - operator/read-only workflow surfaces (tracked: `src/app/operator` 3, `src/components/operator` 2, `src/lib/operator` 18; untracked `src/lib/operator` 19):
     Read-only/visibility (review/test first):
     - Page/auth: `src/app/operator/page.tsx`, `src/app/operator/page.test.tsx`, `src/app/operator/operator-auth-controls.test.ts`
     - Onboarding preview: `src/components/operator/onboarding-wizard.tsx`, `src/components/operator/onboarding-wizard.test.tsx`
     - Gates, readiness, queue, guided onboarding, curation-promotion: `src/lib/operator/authorization.test.ts`, `src/lib/operator/browser-write-controls.ts`, `src/lib/operator/browser-write-controls.test.ts`, `src/lib/operator/readiness.ts`, `src/lib/operator/readiness.test.ts`, `src/lib/operator/review-queue.ts`, `src/lib/operator/review-queue.test.ts`, `src/lib/operator/guided-onboarding.ts`, `src/lib/operator/guided-onboarding.test.ts`, `src/lib/operator/curation-promotion.ts`, `src/lib/operator/curation-promotion.test.ts`
     - Evidence planning (untracked): `src/lib/operator/evidence-draft-packet.ts`, `src/lib/operator/evidence-draft-packet.test.ts`, `src/lib/operator/evidence-candidate-cluster-plan.ts`, `src/lib/operator/evidence-candidate-cluster-plan.test.ts`, `src/lib/operator/evidence-gap-lead-plan.ts`, `src/lib/operator/evidence-gap-lead-plan.test.ts`, `src/lib/operator/evidence-freshness-review-cadence.ts`, `src/lib/operator/evidence-freshness-review-cadence.test.ts`, `src/lib/operator/evidence-batch-qa-simulator.ts`, `src/lib/operator/evidence-batch-qa-simulator.test.ts`
     Write-boundary (Codex review before code changes):
     - Tracked: `src/lib/operator/audit.ts`, `src/lib/operator/browser-write-actions.ts`, `src/lib/operator/browser-write-actions.test.ts`, `src/lib/operator/claim-packet-review.ts`, `src/lib/operator/claim-packet-review.test.ts`, `src/lib/operator/source-candidate-actions.ts`, `src/lib/operator/source-candidate-actions.test.ts`, `src/lib/operator/supplement-onboarding-drafts.ts`, `src/lib/operator/supplement-onboarding-drafts.test.ts`
     - Untracked: `src/lib/operator/changelog-publication.ts`, `src/lib/operator/changelog-publication.test.ts`, `src/lib/operator/claim-review-records.ts`, `src/lib/operator/evidence-draft-apply.ts`, `src/lib/operator/evidence-draft-apply.test.ts`, `src/lib/operator/evidence-impact-pipeline.ts`, `src/lib/operator/evidence-impact-pipeline.test.ts`, `src/lib/operator/trial-alert-actions.ts`, `src/lib/operator/trial-alert-actions.test.ts`
     Checks: operator visibility tests first; evidence planning tests second; write-boundary tests only after Codex review. No broad validation.
     Result on 2026-06-21: operator visibility tests passed (9 files, 50 tests); evidence planning tests passed (5 files, 21 tests).
   - source-candidate/data pipeline
   - public dashboard/app readability
   - evidence/domain helpers: analytics, outcome categories, product labels, seed normalized evidence, safety domains, trial alerts
   Codex boundaries: no public route writes; no DB writes/migrations; no `Human reviewed` without human confirmation; no medical/regulatory/citation meaning changes without review.
2. Prisma schema, migrations, and seed.
3. Scripts and reporting.
4. Docs archive and reference.
5. Remaining root docs such as `README`.

Hard stops: ask first before production deploy, DB mutation/migration, secrets, destructive tracked-work cleanup, or medical/regulatory boundary changes.

## Next Action

- Work from the simplified roadmap and choose the most useful product-facing improvement.
