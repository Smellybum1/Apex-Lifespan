# Source Candidate Scoped Listing

## Goal
Let local operators narrow read-only source-candidate listings to a specific ingestion job, intervention, or claim before review.

## Constraints
- Keep this under `npm run ingest:sources -- --candidates`.
- Do not add public write/read routes for source-candidate review.
- Preserve existing source/decision/limit behavior.
- Keep outputs framed as source-candidate review rows and triage scores, not curated evidence.

## Done Condition
- `--candidates` accepts `--candidate-job-id`, `--candidate-intervention-id`, and `--candidate-claim-id`.
- Data helper applies those filters with existing source/decision/limit filters.
- Parser rejects those filters unless `--candidates` is present and keeps them isolated from queue/run/review/detail modes.
- README and project memory document the scoped listing workflow.

## Files Likely Touched
- `src/lib/data/source-candidates.ts`
- `src/lib/data/source-candidates.test.ts`
- `src/lib/data/source-candidate-job-command.ts`
- `src/lib/data/source-candidate-job-command.test.ts`
- `README.md`
- `docs/codex/project.md`

## Steps
1. Extend review-queue options and Prisma `where` mapping with optional intervention, claim, and ingestion job ids.
2. Add CLI flags and include them in read-only candidate-list isolation checks.
3. Add targeted helper/parser/runner tests.
4. Update docs and run targeted plus broad validation.

## Validation
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Risks
- Filter names must stay distinct from run `--job-id` and queue metadata flags.
- These filters should not accidentally become write-mode metadata.
