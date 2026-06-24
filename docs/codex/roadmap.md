# Roadmap

Last updated: 2026-06-21

Compact product roadmap. The old internal artifact chain is no longer active roadmap work.

## Target

Make Apex Lifespan a useful evidence intelligence product for supplements, peptides, and healthspan interventions. It should help a user understand scoped claims, evidence strength, safety context, AU/TGA context, uncertainty, and product-level limits without becoming medical advice or a supplement leaderboard.

## Hard Stops

- Ask first before production deploy, DB mutation/migration, secrets, destructive actions, or medical/regulatory boundary changes.
- Use `Human reviewed` only when a human explicitly confirms it.
- Do not infer ARTG/AUST status from generic intervention evidence.
- Do not provide peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Active Milestones

### 1. Make The Public Evidence Map More Useful

Improve the pages normal users see first: evidence map, intervention detail pages, safety context, regulatory context, search/filtering, and plain-language uncertainty.

Done when the public app feels useful without operator knowledge.

### 2. Add More Real Coverage

Add a small, high-value batch of interventions or product states with traceable citations, scoped claims, uncertainty labels, and AU/TGA/product caveats.

Done when the public surface has meaningfully broader coverage without weakening citation traceability.

### 3. Make Evidence Intake Simple

Replace the old operator artifact chain with a straightforward local flow: collect a source, map it to a scoped claim, capture the useful fields, and update local evidence data only when the user explicitly wants a write.

Done when adding or updating evidence is a short, understandable workflow.

### 4. Improve Trust And Readability

Polish copy, empty states, confidence language, caveats, and visual hierarchy so users can quickly see what is known, uncertain, missing, or product-specific.

Done when the product reads as calm, conservative, and clear.

### 5. Add Privacy-Safe Operating Signals

Report only aggregate, non-sensitive usage and quality signals. Avoid user-level identifiers and raw health/search/label text.

Done when project health is visible without creating a privacy problem.

## Retired From Active Roadmap

- Internal process milestones.
- Composer ratio monitoring.
- Roadmap entries that exist only to prove another internal process step.

Historical files can stay in git history or archive context, but they should not drive new work.

## Next Work Rule

Pick the most useful product-facing improvement, implement it directly, and run checks only when they are worth their cost for that change.
