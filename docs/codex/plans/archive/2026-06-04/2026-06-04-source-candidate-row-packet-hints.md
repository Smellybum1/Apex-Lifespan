# Source Candidate Row Packet Hints

## Goal

Add copyable packet commands to source-candidate list rows so ordinary review queue slices can jump straight into read-only packet review.

## Constraints

- Keep candidate listing read-only.
- Do not accept, reject, link, extract, or promote candidates.
- Preserve triage-score wording as source-candidate review triage.
- Do not touch public routes or dashboard behavior.

## Acceptance

- `--candidates` rows include `packet="--candidate-review-packet ..."` alongside the shell-safe key.
- Reviewed candidate rows keep the same review-state wording and add the same packet hint.
- Tests cover the row output.
- Workflow docs and handoff mention row packet hints.

## Validation

- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --candidates --candidate-claim-id omega-3-cv-events --candidate-intervention-id omega-3 --candidate-region AU --candidate-source pubmed --candidates-limit 3`
- `npm run test`
- `npm run lint`
- `npm run dev:stop`
- `npm run typecheck`
