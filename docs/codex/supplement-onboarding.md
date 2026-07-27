# Supplement Onboarding

Conditional/reference workflow. Do not load during ordinary startup or routine local dashboard work. Use this only when adding a new supplement/intervention or repairing old onboarding docs.

## Current Direction

The active product path is local database work plus the dashboard-assisted ingestion/candidate flow. For most new evidence work, prefer:

1. Add or update the local catalog row/data using the current codebase patterns.
2. Start broad local ingestion from the dashboard.
3. Review candidates in Candidate Review.
4. Process accepted candidates.
5. Use Benefit Discovery and Identity Resolver to create conservative local draft claims or links.

## Script Fallback

The historical onboarding helpers still exist as scripts, but their old package aliases are not part of the current command surface. If you need them, inspect the script and run it directly with `npx tsx`:

```bash
npx tsx scripts/onboarding-guide.ts --help
npx tsx scripts/onboarding-seed-diff.ts --help
npx tsx scripts/onboarding-review-packet.ts --help
npx tsx scripts/full-text-source-readiness.ts --help
```

Use these only when they save time for a specific onboarding task. Do not recreate packet/rehearsal/readiness chains as routine workflow.

## Boundaries

- Keep onboarding writes local unless the user explicitly asks for preview/production promotion.
- Imported or drafted records must remain unreviewed until a human explicitly confirms review.
- Product-level ARTG/AUST status requires product-level evidence.
- Source queueing, candidate review, study extraction, and public promotion remain separate explicit tasks.
- Avoid medical advice and peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Reference

- Full historical command detail: `docs/codex/reference/supplement-onboarding-command-reference.md`.
- Completed implementation history: `docs/codex/plans/archive/`.
