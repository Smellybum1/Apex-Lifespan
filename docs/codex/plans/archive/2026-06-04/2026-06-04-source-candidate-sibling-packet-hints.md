# Source Candidate Sibling Packet Hints

## Goal

Add copyable packet commands to source-candidate sibling rows so operators can move from duplicate or context sibling review into a read-only packet without reconstructing keys.

## Constraints

- Keep sibling output read-only.
- Do not accept, reject, link, extract, or promote candidates.
- Preserve source-candidate triage wording and match reasons.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- `--candidate-siblings` rows include `packet="--candidate-review-packet ..."` beside each sibling key.
- Review packet sibling sections reuse the same row hint.
- Tests cover sibling output.
- Workflow docs and handoff mention sibling packet hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-siblings b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
