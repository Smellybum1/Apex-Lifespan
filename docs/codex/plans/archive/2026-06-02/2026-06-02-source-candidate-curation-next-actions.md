# Source Candidate Curation Next Actions

## Goal

Make the read-only source-candidate curation status and handoff outputs tell operators the next concrete curation action for each accepted candidate readiness state.

## Constraints

- Keep this under the local `npm run ingest:sources` operator workflow.
- Do not auto-promote source candidates into public evidence.
- Keep wording framed as curation handoff readiness, not source quality or medical advice.
- Preserve existing status labels, filters, and read-only behavior.

## Done Condition

- Curation status objects expose a derived next-action string.
- `--candidate-curation-status` and `--candidate-curation-handoff` print `nextAction=...`.
- Focused tests cover each new output path.
- README and project memory mention next-action guidance.

## Files Likely Touched

- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps

1. Add a small status-to-next-action helper in the curation data layer.
2. Thread the field through formatter output.
3. Update focused tests for data and command formatting.
4. Update docs for the operator command behavior.
5. Run targeted validation, then broader checks.

## Validation

- `npm run test -- src/lib/data/source-candidates.test.ts src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks

- Output wording could imply evidence approval rather than curation readiness.
- Adding a required field to test doubles may need updates wherever curation statuses are mocked.
