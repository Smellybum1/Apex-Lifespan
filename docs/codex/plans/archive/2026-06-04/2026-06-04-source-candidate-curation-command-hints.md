# Source Candidate Curation Command Hints

## Goal

Add read-only navigation hints to curation status and draft output so operators can return to packet, reference-match, group-list, and paired curation views without reconstructing commands.

## Constraints

- Keep curation status and draft output read-only.
- Do not accept, reject, link, extract, create references, queue, run, or promote anything.
- Preserve curation readiness wording and manual-review gates.
- Keep public routes and dashboard behavior unchanged.

## Acceptance

- Curation status output includes packet, reference-match, group-list, and curation-draft hints.
- Curation draft output includes packet, reference-match, group-list, and curation-status hints.
- Tests cover accepted, blocked, and not-accepted curation outputs.
- Workflow docs and handoff mention curation command hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-curation-status b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --candidate-curation-draft b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
