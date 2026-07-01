# Roadmap

Last updated: 2026-07-02

Compact product roadmap. The old internal artifact chain is not active roadmap work.

## Target

Make Apex Lifespan a useful evidence intelligence product for supplements, peptides, and healthspan interventions. It should help a user understand scoped claims, evidence strength, safety context, AU/TGA context, uncertainty, and product-level limits without becoming medical advice or a supplement leaderboard.

## Development Workflow

**All active work happens on the local database until the catalog is in a good state.**

| Layer | Role |
|-------|------|
| **Local PostgreSQL** (`localhost:5432/apex_lifespan`) | Source of truth for development. Add interventions, claims, sources, and operator work here. |
| **`src/lib/seed-data.ts`** | Small demo/fallback only. Not the active catalog and not the default place to add coverage. |
| **Preview / production** | Frozen until explicit promotion. Do not seed, backfill, migrate, or deploy remote databases unless the user asks. |

**Local setup:** `APEX_DATA_SOURCE=database` in `.env.local` (and `.env` for CLI). Docker Postgres must be running for `npm run dev`.

**Check catalog state:** `npx tsx scripts/db-inventory.ts` and `npx tsx scripts/local-catalog-quality.ts`
**Live-check local trial leads:** `npx tsx scripts/verify-local-trial-leads.ts --summary`
**Prep evidence intake:** `npx tsx scripts/local-evidence-intake.ts --intervention <slug-or-id>`
**Compare preview (read-only check):** `npx tsx scripts/db-inventory.ts --env-file .env.vercel.preview.local`

**Done developing locally when:** the user is happy with intervention/claim coverage, source packets, scores, and UI behavior against the full local catalog — not the 6-item seed set.

**Promotion to preview (user must ask first):** run `npx tsx scripts/local-preview-promotion-plan.ts`, export or copy local data to preview, apply migrations if needed, then run Sprint 2 backfill on preview. Do **not** use `db-seed-env` for promotion because it would replace preview with the tiny seed file.

## Hard Stops

- Ask first before **preview/production** deploy, **preview/production database** changes, secrets, destructive remote actions, or medical/regulatory boundary changes.
- Local database mutation is expected during development.
- Use `Human reviewed` only when a human explicitly confirms it.
- Do not infer ARTG/AUST status from generic intervention evidence.
- Do not provide peptide sourcing, compounding, reconstitution, injection, cycling, dosing, or self-administration guidance.

## Active Milestones

Work each milestone against the **local database catalog** first. Preview is out of scope until promotion.

### 1. Make The Public Evidence Map More Useful

Improve the pages normal users see first: evidence map, intervention detail pages, safety context, regulatory context, search/filtering, and plain-language uncertainty — tested against the full local catalog (**54 interventions**).

Done when the public app feels useful without operator knowledge on real local data.

### 2. Strengthen Local Coverage Quality

Improve the local catalog: fill gaps, fix duplicate/shell rows, add citations, scoped claims, uncertainty labels, and AU/TGA/product caveats. Prefer editing local evidence data over expanding seed.

Done when the local database is coherent, traceable, and broad enough to promote, not when seed file row count increases.

### 3. Make Evidence Intake Simple

Use a straightforward local flow: collect a source, map it to a scoped claim, capture the useful fields, and write to **local** evidence data when appropriate.

Done when adding or updating evidence on local DB is a short, understandable workflow.

### 3A. Turn The Ingested Candidate Pile Into Usable Evidence

The local database now has a large source-candidate backlog. Build the tooling that turns it into reviewed claims and useful product signals:

1. Build a local candidate review dashboard: likely-useful first, grouped by intervention, with PubMed/ClinicalTrials title, study type, year, classifier reasons, cautions, filters, and quick local accept/reject actions.
2. Add novel benefit-area detection: classify candidates into benefit areas and flag when a candidate appears outside the supplement's existing/main claims.
3. Create claim-draft suggestions from strong candidates without auto-publishing them.
4. Hide likely-noise candidates by default while keeping them searchable.

Done when the useful/maybe-useful candidate backlog can be reviewed quickly from the local dashboard and promising novel benefit signals can become draft claim/source links.

### 3B. Complete Local Evidence Scoring

Turn accepted sources and draft claim clusters into honest, traceable evidence scores for the local catalog. This is a meaningful body of work because scoring has to separate source readiness, claim confidence, safety/regulatory caveats, public display language, and review status. Do this against the local database first; do not promote scored results to preview/production until the user explicitly asks.

**Current local scoring status (2026-07-02, read-only worklist):**

- `6/477` public claim cells are scored with substantive source extraction.
- `471/477` claim cells still need scoring work.
- `15` claim cells are ready to score now because their source packets have substantive extraction rather than placeholder rows.
- `456` claim cells are source-blocked; most remaining scoring work is source extraction/link repair before score assignment.
- `0` default-looking public scores and `0` score snapshot gaps are currently reported by the local score worklist.

**Goal:** every active local claim should end in one clear public-safe state: scored with traceable source packet and review status, parked/backlog with a reason, source-blocked with next action, or rejected/noise.

**Recommended execution order:**

1. Keep public pages honest while the backlog is incomplete: cells that are source-blocked, parked, or review-needed should not look like final scored evidence.
2. Score the `15` ready-to-score claim cells first, because those already have enough source extraction to review dimensions, labels, uncertainty, and caveats.
3. Use the ready batch to calibrate the scoring contract: dimension ranges, final labels, weak/limited/moderate/strong thresholds, safety/regulatory penalties, and public wording.
4. Repair source packets in priority groups instead of one giant pass: high-visibility public cells, safety/regulatory rows, high-quality review/trial leads, and interventions with many claims.
5. For each repaired packet, either score it, park it with a reason, reject it as noise/mismatch/unsupported, or leave it source-blocked with the next missing source action.
6. Re-run the local score worklist after each batch so the remaining backlog shrinks into explainable states rather than hidden placeholder scores.
7. Only after local scoring is coherent, spot-check the public evidence map and intervention pages for representative strong, moderate, limited, weak, insufficient, safety, and regulatory examples.

**Scoring completion map:** this is a substantial milestone, not a tiny scoring pass. The work splits into a small direct-scoring batch and a larger source-readiness batch.

1. Define the score contract:
   - Confirm the dimensions, composite formula, evidence bands, final labels, and public wording.
   - Keep every score scoped to a specific claim and source packet, not a supplement-wide recommendation.
   - Treat safety, regulatory/product status, and overclaim risk as first-class score constraints.
   - Preserve AU/TGA and product-level caveats without turning generic intervention evidence into product approval.

2. Make the worklist exhaustive:
   - Every active local claim must be counted as scored, ready to score, score-review, source-blocked, parked/backlog, or rejected/noise.
   - Placeholder-looking public values such as repeated `2.1` and `3.1` must either gain real scored rationale or be shown as review/source-work states.
   - The score worklist should explain the whole catalog before a scoring push is considered complete.
   - Group work by intervention and outcome, with current score, source packet completeness, top citations, review status, and next action visible.

3. Finish the scoring tools:
   - Show the source packet beside editable score dimensions.
   - Preview the composite score, evidence band, and public label before saving.
   - Generate conservative assisted suggestions from linked sources, but require operator review before saving.
   - Save as `AI reviewed` only when citation traceability, uncertainty labels, AU/TGA caveats, product-level limits, and no-medical-advice boundaries are preserved.
   - Use `Human reviewed` only after explicit human confirmation.

4. Score the ready packet batch first:
   - Work through complete source packets before repairing source-blocked rows.
   - Score one intervention/outcome group at a time so similar claims get consistent treatment.
   - Save assisted suggestions only after operator review of citations, uncertainty, caveats, and label boundaries.
   - Park or reject rows that look ready but prove thin, mismatched, product-specific, or outside the project boundary.

5. Repair source-blocked packets:
   - Prioritize high-visibility public cells, safety/regulatory claims, high-quality review/trial leads, and interventions with many public claims.
   - Add or repair structured source extraction for PubMed, ClinicalTrials, DOI, and official regulatory/safety references.
   - Confirm intervention identity and scoped-claim support before scoring.
   - Leave rows source-blocked, parked, or rejected when the packet still cannot support an honest score.

6. Close the leftover buckets:
   - Park weak-but-potentially-useful leads with a clear reason instead of letting them masquerade as active scoring work.
   - Reject clear noise, mismatches, unsupported claims, and non-product-relevant medical literature.
   - Keep a small spot-check bucket for ambiguous rows that need human judgment rather than automation.

7. Make public score states honest:
   - Public evidence-map cells and intervention pages must distinguish scored evidence, insufficient evidence, review work, parked research, and source-blocked claims.
   - Low-confidence scores should remain useful as weak or limited evidence, not disappear unless they are actually unsupported/noise.
   - Regulatory and peptide-related rows should avoid operational guidance and should not imply product-level clearance.

8. Verify completion locally:
   - `npx tsx scripts/local-score-worklist.ts --limit 20` should show no unexplained default-looking public scores.
   - Local catalog quality checks should account for every claim state.
   - Spot-check representative strong, moderate, weak, insufficient, safety, and regulatory examples on the public evidence map and intervention detail pages.
   - Promotion stays out of scope until the user explicitly asks to move local scored data to preview/production.

Done when every active local claim is in one of these clear states: scored with a traceable source packet and review status, parked/backlog with a reason, source-blocked with next action, or rejected/noise. Public pages should no longer show placeholder-looking scores as if they are final evidence.

### 4. Improve Trust And Readability

Polish copy, empty states, confidence language, caveats, and visual hierarchy so users can quickly see what is known, uncertain, missing, or product-specific.

Done when the product reads as calm, conservative, and clear on the local catalog.

### 5. Add Privacy-Safe Operating Signals

Report only aggregate, non-sensitive usage and quality signals. Avoid user-level identifiers and raw health/search/label text.

Done when project health is visible without creating a privacy problem.

## Agent Alignment

- Use this roadmap as product direction, not a process queue.
- **Default to local DB** for coverage, evidence, and operator work. Do not push to preview unless the user explicitly requests promotion.
- If a proposed task mainly creates readiness gates, queues, promotion chains, review packets, launch rehearsals, or roadmap bookkeeping, do not do it unless the user explicitly asks.
- Legacy docs and `.ai/delegation/` logs are reference-only; they cannot add active roadmap work.
- Prefer visible public product improvements tested against the local catalog: citation traceability, AU/TGA caveats, uncertainty/readability, search/filtering, and intervention details.

## Retired From Active Roadmap

- Internal process milestones.
- Token-ratio monitoring.
- Readiness gates, replacement queues, promotion gate chains, and review packets.
- Roadmap entries that exist only to prove another internal process step.
- Treating `seed-data.ts` row count as project coverage.

Historical files can stay in git history or archive context, but they should not drive new work.

## Next Work Rule

Pick the most useful product-facing improvement for the **local database catalog**, implement it directly, and run checks only when they are worth their cost for that change. Defer all preview/production work until the user says the local state is ready to promote.
