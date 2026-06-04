# Source Candidate Progress Archive

Archived from `docs/codex/handoff.md` on 2026-06-04 during context-efficiency cleanup. Reference only; do not load during normal startup.

## Recent Source-Candidate Work

- Curation readiness is guarded:
  - accepted-reference mismatch blocks readiness;
  - accepted candidates without a claim id report `Candidate claim missing`;
  - handoff/status wording stays source-packet readiness, not evidence quality.
- Database-mode dashboard regression coverage verifies claim reference links and structured study extraction rows map into complete public source packets.
- Operator-only curation views include candidate detail, siblings, reference matches, curation status, curation draft, curation handoff, summary, and review packet output.
- Review actions can accept/reject pending candidates with human constraints.
- `--link-candidate-claim <dedupe-key>` is a guarded local write that upserts only the accepted reference's `ClaimReference`; it does not create references, studies, or public promotions.
- `--extract-candidate-study <dedupe-key>` is a guarded local write that creates or explicitly updates only a structured `Study` extraction after acceptance, matching-reference, claim-context, and claim-link gates pass.
- `--queue-claim-sources <claim-id>` queues or reports the claim-scoped PubMed and ClinicalTrials.gov jobs generated from active-claim source terms without running ingestion or writing review/curation rows.
- `--summary` shows source-candidate ingestion job status counts before backlog and curation handoff counts.
- `--jobs --jobs-status queued` lists only queued source-candidate ingestion jobs.
- `--jobs-source`, `--jobs-region`, `--jobs-intervention-id`, and `--jobs-claim-id` can narrow read-only job lists.
- Candidate-oriented output includes `key=b64:...`; use that shell-safe value on Windows anywhere a source-candidate `<dedupe-key>` is accepted.
- `--candidates --candidate-external-id <id>` narrows the read-only review queue by PMID/NCT id and list rows show `externalId=...` for duplicate source-identity scans.
- `--candidates --candidate-duplicates` surfaces duplicate PMID/NCT identity groups across query and claim scopes without changing review state.
- `--candidate-review-packet <dedupe-key>` prints detail, accepted-reference matches, and same-identity siblings for one candidate without changing review state.
- Empty accepted-reference match output includes a draft-only `referenceDraft=...` line for manual curated-reference creation; it does not write references or accept candidates.

## Recent Validation

- `npm run db:validate`
- `npm run db:generate`
- `npm run test -- src/lib/data/source-candidate-jobs.test.ts`
- `npm run test -- src/lib/data/source-candidate-job-command.test.ts`
- `npm run test -- src/lib/data/source-candidates.test.ts`
- `npm run test -- src/lib/data/dashboard.test.ts`
- `npm run ingest:sources -- --help`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- HTTP smoke for `http://localhost:3000` returned `200`
