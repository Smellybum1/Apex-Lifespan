# Promotion Readiness Prep Plan

Date: 2026-06-12
Status: complete

## Boundary

- Keep source-candidate review and promotion human-owned.
- Do not accept or reject candidates, link claims, extract studies, mark review status human-reviewed, or promote public evidence.
- Improve read-only inspection against the approved ignored env file so the operator can review pending candidates without pasting secrets into the shell.
- Public routes remain read-only.

## Steps

1. Confirm launch promotion readiness and current candidate review state in Preview.
2. Add `--env-file` support to `npm run ingest:sources` at the script runner layer before Prisma-backed imports.
3. Refresh command usage and compact workflow docs with env-file examples.
4. Generate a read-only packet for the top pending candidate group.
5. Validate source-candidate command tests and readiness summaries.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts src/lib/env-file.test.ts` passed.
- `npm run ingest:sources -- --help` includes `--env-file <path>`.
- `npm run ingest:sources -- --env-file .env.vercel.preview.local --summary` reports 1 succeeded PubMed job, 3 pending source candidates, and 0 accepted curation handoff rows.
- `npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-review-overview --candidate-review-overview-limit 10` reports one pending PubMed group from the creatine scheduled query.
- Read-only packets for `PMID 42158825` and `PMID 42141930` were inspected; both remain pending review with no accepted-reference match.
- `npm run promotion:readiness -- --env-file .env.vercel.preview.local --summary` reports 0 accepted promotion rows.
- `npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-curation-handoff --candidate-curation-handoff-limit 10` reports 0 accepted curation handoff rows.
- `npm run launch:readiness -- --env-file .env.vercel.preview.local --summary` remains 5 ready, 6 blocked, and 1 warning.
- `npm run typecheck` passed.
- `git diff --check` passed with Windows line-ending warnings only.

## Result

- Added env-file loading to the source-candidate CLI runner without changing the human-owned review/write gates.
- The next promotion step remains a human review decision: accept or reject a pending candidate only after source identity, claim fit, and curated reference are checked.
- No candidates were accepted/rejected, claim-linked, extracted, marked human-reviewed, or promoted.
