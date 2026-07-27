# Psyllium Coverage Draft Plan

Date: 2026-06-12
Status: complete

## Boundary

- Add only a scoped, citation-linked psyllium draft claim and matching structured extraction.
- Keep the claim `Unreviewed AI draft`; do not mark any claim or source candidate human-reviewed.
- Do not accept/reject source candidates, claim-link candidates, extract candidate studies, or promote public evidence.
- Keep public routes read-only and avoid individualized advice, dosing instructions, product sourcing, or product-level AU/TGA assumptions.
- Use the ignored env-file path only for read/report checks or an explicit non-production seed refresh after review-state safety checks.

## Steps

1. Add a conservative psyllium lipid claim backed by a curated PubMed reference and structured study extraction.
2. Add env-file support to coverage and promotion read-only CLIs so Preview evidence can be inspected without pasting secrets into the shell.
3. Refresh tests that intentionally tracked psyllium as the only intervention gap.
4. Validate seed integrity, source packets, coverage reports, promotion reports, launch readiness, and diff hygiene.
5. Update roadmap and handoff with the validated remaining blockers.

## Validation

- `npm run test -- src/lib/seed-integrity.test.ts src/lib/source-packet.test.ts src/lib/evidence-coverage.test.ts src/lib/operator/curation-promotion.test.ts src/lib/env-file.test.ts src/lib/launch-readiness.test.ts` passed.
- `npm run coverage:review -- --summary` reports 8 complete source packets, 0 intervention gaps, 0 human-reviewed claims, and 8 unreviewed claims.
- `npm run coverage:review -- --env-file .env.vercel.preview.local --summary` reports the same database-backed Preview counts after a non-production seed refresh.
- `npm run promotion:readiness -- --env-file .env.vercel.preview.local --summary` reports 0 accepted source-candidate promotion rows.
- `npm run launch:readiness -- --env-file .env.vercel.preview.local --summary` reports 5 ready, 6 blocked, and 1 warning.
- `npm run coverage:review -- --env-file .env.vercel.preview.local --claim psyllium-ldl-lipids` reports the psyllium packet as ready for human review, still `Unreviewed AI draft`.
- `npm run regulatory:review` passed and still shows product-level AU/TGA statuses as unknown where product records lack verification.
- `npm run typecheck` passed.
- `git diff --check` passed with Windows line-ending warnings only.

## Result

- Added `psyllium-ldl-lipids` as a scoped lipid-biomarker claim with `Unreviewed AI draft` status.
- Added curated reference `brown-dietary-fiber-1999` and structured study extraction `study-brown-dietary-fiber-1999`.
- Added `--env-file` support to read-only coverage and promotion CLIs, plus copy-safe env-file commands in coverage, promotion, and launch readiness worksheets.
- Refreshed Preview Neon seed data after verifying coverage had 0 human-reviewed claims and promotion readiness had no accepted candidate rows.
- Did not accept/reject candidates, claim-link candidates, extract candidate studies, mark claims human-reviewed, or promote public evidence.
