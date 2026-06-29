# Thread Handoff

Resume-only snapshot. Do not load during ordinary startup.

## Current State

- Repo: `D:\Codex\Apex Lifespan`
- Branch: `codex/queue-claim-sources`
- Source of truth for development: local PostgreSQL with `APEX_DATA_SOURCE=database`
- Current worktree is intentionally dirty from the local ingestion/candidate-review/benefit-discovery slice plus workflow doc cleanup. Do not clean, revert, stage, commit, push, or delete unrelated work unless the user explicitly asks.
- Verify live catalog counts from the local dashboard or `npx tsx scripts/db-inventory.ts`; do not trust old handoff metrics.

## Active Product Slice

- Local ingestion dashboard/API for PubMed and ClinicalTrials.gov discovery.
- Candidate Review with bulk accept/reject.
- Accepted-candidate processor.
- Benefit Discovery auto-build/preview for conservative local draft claims.
- Identity Resolver for wrong/ambiguous supplement matches.
- Context-efficiency docs now point ordinary startup at `AGENTS.md` + `docs/codex/project.md` only.

## Hard Stops

- Ask before preview/production deploys, preview/production DB changes, migrations, secrets, destructive cleanup, or medical/regulatory boundary changes.
- Use `Human reviewed` only after explicit human confirmation.
- Public routes stay read-only.
- Do not infer product-level ARTG/AUST status from generic intervention evidence.
- Avoid medical advice and peptide operational guidance.

## Next Useful Checks

- Docs-only changes: `git diff --check -- <docs>`
- UI/local ingestion changes: `npm run lint`, targeted tests where practical, then `npm run typecheck` when shared TypeScript changed.
- If Prisma generation is locked on Windows, stop only the Apex dev server, rerun the check, then restart it.

## Retired From Active Work

- Readiness gates, promotion chains, Composer/token-ratio monitoring, launch rehearsals, generated packets, and `.ai/delegation/` logs as backlog or instructions.
