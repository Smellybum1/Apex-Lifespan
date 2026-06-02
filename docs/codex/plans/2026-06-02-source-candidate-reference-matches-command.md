# Source Candidate Reference Matches Command

## Goal
Add read-only local visibility into curated references that can satisfy `--accept-candidate` for a source candidate.

## Constraints
- Keep public app routes read-only; this remains a local operator command.
- Reuse the same source/external-id matching rules used by source-candidate acceptance.
- Do not promote evidence cards or mutate source-candidate review state.
- Keep terminal output compact and escaped.

## Done Condition
- `npm run ingest:sources -- --candidate-reference-matches <dedupe-key>` prints matching curated reference ids for a candidate.
- Missing candidates fail clearly.
- Tests cover PubMed, ClinicalTrials.gov, URL normalization, no-match, and command isolation.
- README and Codex project docs describe the operator flow.

## Files Likely Touched
- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps
1. Add a backend helper that fetches one candidate plus same-source references and filters with the existing match predicate.
2. Add CLI parsing, validation, usage, runner injection, and formatting for the read-only mode.
3. Add focused tests for helper behavior and command behavior.
4. Update operator docs and run targeted then broad validation.

## Validation
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Match hints must not diverge from acceptance checks.
- Generic ClinicalTrials.gov references must not appear as eligible matches.
- Output should not imply accepted source candidates are promoted evidence.
