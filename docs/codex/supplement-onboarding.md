# Supplement Onboarding

Compact active hub for adding or reviewing supplements. Full command detail lives in `docs/codex/reference/supplement-onboarding-command-reference.md`.

## Use This First

- New supplement draft: `npm run onboarding:guide -- --name <supplement> --summary`.
- Existing supplement review: `npm run onboarding:guide -- --supplement <id-or-slug> --summary`.
- Batch draft review: `npm run onboarding:guide -- --batch-file <reviewed-batch-json> --summary`.
- Existing batch review: `npm run onboarding:guide -- --supplements <id-or-slug,id-or-slug> --summary`.
- Full-text source gate next step: `npm run onboarding:fulltext-sources -- --next --summary`.

The guide wraps the packet builders and recommends one safest next command. Open the reference doc only when you need the exact command surface or mode-specific behavior.

## Boundaries

- Onboarding helpers are read-only by default.
- Local review-kit writers create local Markdown/JSON review artifacts only.
- Source queueing, candidate decisions, extraction writes, claim review, connector approval, live full-text fetch, and public promotion remain separate explicit workflows.
- Imported database drafts create only draft interventions, unreviewed claims, and Unknown AU/TGA placeholders behind the reviewed operator import gate.
- Do not infer product-level ARTG/AUST status from ingredient evidence.
- Avoid peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Common Flow

1. Draft the supplement and scoped claims with `onboarding:guide`.
2. Generate a local review kit when the draft is worth reviewing.
3. Review claim scope, safety/watchlist flags, AU/TGA product-status gaps, and source-query plan.
4. Use seed-diff/import-assistant outputs for manual review or the separately gated operator draft import.
5. Queue sources only after reviewed records exist.
6. Accept/reject candidates, extract studies, mark claim packets reviewed, and promote public evidence only through explicit operator-owned steps.
7. Use monitor/status/quality summaries for stale evidence, missing source tracking, full-text gates, and next actions.

## Reference

- Full onboarding command reference: `docs/codex/reference/supplement-onboarding-command-reference.md`.
- Connector approval decision evidence: `docs/codex/onboarding/fulltext-connector-approval-decision.md`.
- Plans and completed implementation history: `docs/codex/plans/archive/` and the command reference history section.
