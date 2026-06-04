# Source Candidate Detail Command Hints

## Goal

Add read-only command hints to direct source-candidate detail output so operators can jump from `--candidate-detail` to packet, reference-match, sibling, group-list, and curation views without reconstructing commands.

## Constraints

- Keep `--candidate-detail` read-only.
- Do not accept, reject, link claims, extract studies, create references, queue, run, or promote anything.
- Keep review-packet output readable; avoid duplicating command-hint blocks inside the embedded detail section.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Direct `--candidate-detail` output includes read-only packet, reference-match, sibling, group-list, curation-status, and curation-draft hints.
- Review-packet embedded detail output does not duplicate the direct detail hint block.
- Tests cover direct detail hints and escaped-value detail output.
- Workflow docs and handoff mention the new detail hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-detail b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
