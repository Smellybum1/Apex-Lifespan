# Operator Evidence-Impact Handoff History

Archived on 2026-06-19 during context-efficiency cleanup. This file preserves detail removed from the resume handoff; do not read it during ordinary startup.

## Archived Active Work Detail

- Roadmap Goal 1 focused on the approval-ready publication path while keeping writes explicit, locally validated, and requested only as exact execution decisions.
- Evidence-impact pipeline slices added `npm run evidence:apply-ready`, `npm run evidence:apply-ready -- --fixture-ready`, and `npm run evidence:apply-ready -- --write`.
- Dry-runs carried write previews with transactionality, write scope, verification, rollback notes, command copy, a DB-unreachable read-only fallback, and a deterministic no-DB ready-promotion fixture.
- Task-owned evidence-impact work included `scripts/apply-ready-evidence-packets.ts`, `src/lib/operator/evidence-impact-pipeline.ts`, and `src/lib/operator/evidence-impact-pipeline.test.ts`.
- Review Agent/operator evidence work included packet and rehearsal files such as `src/lib/operator/apex-review-agent.ts`, `src/lib/operator/evidence-draft-review-actions.ts`, and `src/components/operator/apex-review-agent-panel.tsx`.
- Evidence-draft dry-run rehearsal carried target-row transaction preview, verification checks, rollback notes, and command copy while keeping real writes disabled.
- `src/lib/operator/evidence-draft-apply.ts` and focused tests added an approved evidence-draft apply executor behind operator write permissions. It applies only ready drafts through one Prisma transaction and refuses rejected, unreviewed, or unknown-field drafts before any transaction opens.
- Browser/operator wrappers connected claim-link, study-extraction, claim-packet-review, public-promotion, local DB apply approval, public changelog publication approval, exact approval IDs, operator write-control evidence, pre-apply validation, stop conditions, and rollback evidence.
- Review Agent apply dry-runs included no-write public-read previews for Evidence Map, detail, and changelog surfaces, citation traceability, uncertainty labels, review state, AU/TGA/product caveats, public read-model projection fields, route smoke checks, score history, and unpublished changelog projection.
- Public changelog publication carried approval-request packets, command copy, browser/form wrappers, readiness visibility, and disabled/not-yet-enabled UI until dedicated publication controls are ready.
- Evidence-impact apply-ready dry-runs carried approval-request shapes for claim-link and public-promotion write previews, including copyable approval phrase, `--write`/`--actor-email` inputs, operator permissions, write scope, stop conditions, and command copy.

## Archived Validation Detail

- Evidence impact and draft-packet tests passed: `npm run test -- src/lib/operator/evidence-impact-pipeline.test.ts src/lib/operator/evidence-draft-packet.test.ts`.
- Evidence draft/browser/operator focused tests passed: `npm run test -- src/lib/operator/evidence-draft-review-actions.test.ts src/lib/operator/browser-write-actions.test.ts src/app/operator/page.test.tsx src/lib/operator/apex-review-agent.test.ts`.
- Evidence draft apply executor and adjacent operator/page tests passed with focused Vitest batches.
- Review Agent validation passed repeatedly with `npm run validate:review-agent`.
- TypeScript passed repeatedly with `npx tsc --noEmit --pretty false` and later `npm run typecheck`.
- Public-read preview, read-model projection, route projection, score/changelog projection, local DB apply approval request, apply-control readout, exact apply approval ID, public changelog approval request, public changelog browser/form wrapper, public changelog readiness, and publication command-copy slices each passed focused tests plus Review Agent and TypeScript checks.
- Production public/operator smoke passed after network approval with `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app --require-database` and `npm run operator:smoke -- https://apex-lifespan.vercel.app --expect-auth-required`.
- Prisma validation and generation passed with `npm run db:validate` and `npm run db:generate`; Windows-safe typecheck passed after `npm run dev:stop`.
- Evidence-impact approval-request and ready-fixture checks passed with `npm run evidence:apply-ready`, `npm run evidence:apply-ready -- --fixture-ready`, expected fail-closed `npm run evidence:apply-ready -- --fixture-ready --write`, focused tests, Review Agent validation, and TypeScript checks.
- Operator readiness summary passed as a read-only check while reporting expected local not-ready checks: operator auth config, active operator, nonproduction write QA, operator flow QA, and browser write-controls approval.
