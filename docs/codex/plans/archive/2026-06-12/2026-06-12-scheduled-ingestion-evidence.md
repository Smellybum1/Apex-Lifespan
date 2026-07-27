# Scheduled Ingestion Evidence Plan

Date: 2026-06-12
Status: complete

## Boundary

- Keep scheduled ingestion source-candidate-only.
- Do not accept/reject candidates, link claims, extract studies, promote public evidence, or change reviewed public packets.
- Keep dry-run read-only and make any write path require explicit `--apply` plus the scheduled ingestion write gate.
- Use the ignored local evidence env file for secrets and proof keys; do not print or commit database URLs, tokens, raw source payloads, or private alert contents.

## Steps

1. Add `--env-file` support to the scheduled ingestion CLI so it can reuse the approved ignored evidence file without pasting secrets into the shell.
2. Add a `--require-hosted-run-readiness` apply-mode guard for hosted-run rehearsal checks.
3. Review the retry policy and current non-production scheduler state.
4. Record scheduler evidence only if hosted cron gates, retry policy evidence, NCBI metadata, source caps, and `noAutoPromotion=true` are verified.
5. Rerun scheduled ingestion, launch, production, operator, operations, coverage, and public smoke checks.

## Validation

- `npm run test -- src/lib/data/scheduled-ingestion.test.ts`
- `npm run ingest:scheduled-dry-run -- --env-file .env.vercel.preview.local --summary`
- `npm run ingest:scheduled-run -- --env-file .env.vercel.preview.local --require-hosted-run-readiness`
- `npm run launch:readiness -- --env-file .env.vercel.preview.local --summary`
- `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app`
- `git diff --check`

## Result

- Scheduled ingestion CLI now supports `--env-file <operations-env-file>` and loads the env file before importing Prisma-backed scheduler code.
- Apply mode now supports `--require-hosted-run-readiness`; the flag is rejected unless `--apply` is present.
- Retry policy approval was recorded locally at `2026-06-12T07:05:06Z` after the dry run reported zero recent failed jobs.
- Non-production hosted-readiness dry run reported no blocked checks, hosted cron ready, hosted-run gate ready, retry policy ready, zero duplicate source identities, and `noAutoPromotion=true`.
- Explicit non-production apply rehearsal processed one queued PubMed job `cmq9nhdcy000iey85ehxzdqz7`, found 3 records, changed 3 source-candidate rows, and left automatic retries disabled.
- Post-run checks reported zero queued jobs, zero failed jobs, and one pending human-review candidate group with 3 source candidates.
- No candidates were accepted/rejected, claim-linked, extracted, promoted into public evidence, or shown on public routes.
