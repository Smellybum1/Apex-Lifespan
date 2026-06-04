# Source Candidate Reference Match Hints

## Goal

Add read-only packet and group-list hints to standalone accepted-reference match output so operators can return from reference checking to full packet or context review without reconstructing commands.

## Constraints

- Keep reference-match output read-only.
- Do not accept, reject, link, extract, create references, queue, run, or promote anything.
- Preserve draft-only reference wording.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- `--candidate-reference-matches` heading includes `packet="..."` and `groupList="..."`.
- Empty reference-match output keeps draft-only wording and also includes the same hints.
- Tests cover matched and empty reference-match output.
- Workflow docs and handoff mention reference-match hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-reference-matches b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
