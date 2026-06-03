# Source Candidate Reference Match Identity

## Goal

Show source-candidate identity in `--candidate-reference-matches` output so operators can verify source, external id, URL, and review state beside eligible curated references before accepting.

## Constraints

- Keep the command read-only.
- Do not change matching rules or review writes.
- Keep output compact and terminal-safe.
- Preserve the public live-source API read-only boundary.

## Done Condition

- Reference-match output includes candidate source, external id, URL, decision, and review status.
- Empty match output still includes candidate identity.
- Tests cover the updated output.
- Operator docs describe candidate identity in the output.

## Files Likely Touched

- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `docs/codex/source-candidate-workflow.md`
- `README.md`

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

## Risks

- Avoid implying reference matches are accepted automatically.
- Avoid leaking irrelevant metadata into a dense operator command.
