# Source Candidate Packet Duplicate Hints

## Goal

Add a copyable duplicate-identity command hint to read-only source-candidate review packets when the packet already shows a same-source/external-id sibling.

## Constraints

- Keep review packets read-only.
- Do not accept, reject, link, extract, or promote candidates.
- Only print the duplicate hint when sibling evidence shows the identity repeats.
- Preserve source-candidate triage wording and human-owned review.

## Acceptance

- Packet command hints include `duplicates="--candidates --candidate-duplicates ..."` for repeated top identities.
- Packets without same-source/external-id siblings do not print the duplicate hint.
- Tests cover packet formatting.
- Workflow docs and handoff mention the packet duplicate hint.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidate-review-packet b64:cHVibWVkfGF1fGNyZWF0aW5lJTIwbW9ub2h5ZHJhdGUlMjBzdHJlbmd0aCUyMHJlc2lzdGFuY2UlMjB0cmFpbmluZyUyMGxlYW4lMjBtYXNzJTIwcmFuZG9taXplZCUyMHRyaWFsJTIwc3lzdGVtYXRpYyUyMHJldmlld3w0MjE0MTkzMHxjcmVhdGluZXxjcmVhdGluZS1zdHJlbmd0aA`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
