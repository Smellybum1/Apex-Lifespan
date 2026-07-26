# Roadmap

Last updated: 2026-07-04

Compact product roadmap. The old internal artifact chain is not active roadmap work.

## Target

Make Apex Lifespan a useful plain-language evidence translator for supplements, peptides, and healthspan interventions. It should help a user understand what human studies, trials, source packets, safety context, AU/TGA context, uncertainty, and product-level limits actually say without becoming medical advice or a supplement leaderboard.

## Product Pivot

The supplement/intervention page is the primary product surface. It should read like an evidence brief: overall plain-language synthesis, common claims versus evidence, what studies tested and found, where evidence is strong/mixed/weak/missing, safety and regulatory caveats, and links back to the source trail.

The heatmap-style matrix is secondary. Keep it as a browse-by-outcome index and audit aid, but do not let score buckets flatten nuance or become the main answer.

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

### 1. Make Supplement Pages The Primary Evidence Brief

Improve the pages normal users should rely on first: intervention detail pages, evidence summaries, common-claim readouts, study findings, source links, safety context, regulatory context, and plain-language uncertainty. Keep the outcome matrix useful for browsing, but frame it as a secondary index tested against the full local catalog (**54 interventions**).

Done when a reader can open a supplement page and understand the evidence without needing to interpret a heatmap score.

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

Turn accepted sources and draft claim clusters into honest, traceable evidence scores for the local catalog. This is a substantial milestone: the remaining work is mostly source identity, source extraction, claim-support repair, score application, and cross-catalog calibration, not just changing the visible scoring formula. Do this against the local database first; do not promote scored results to preview/production until the user explicitly asks.

**Last local scoring snapshot (2026-07-02, read-only worklist):**

Refresh before acting with `npx tsx scripts/local-score-worklist.ts --limit 20` and `npx tsx scripts/local-catalog-quality.ts`; the counts below are a dated snapshot, not live startup context.

- `21/477` public claim cells are scored with substantive source extraction.
- `456/477` claim cells still need scoring work.
- `0` claim cells are ready to score now because the first ready batch has been scored into AI-draft public states with score snapshots.
- `456` claim cells are source-blocked; remaining scoring work is source extraction/link repair before score assignment.
- Linked reference extraction is still sparse (`93/3713` extracted in the local quality readout), so the work is mostly choosing and extracting the right references, not exhaustively processing every linked reference.
- `0` default-looking public scores and `0` score snapshot gaps are currently reported by the local score worklist.

**Scoring objective:** complete local scoring for the `477` active public claim cells by moving each cell into exactly one accountable state: `scored`, `ready-to-score`, `source-blocked`, `parked/backlog`, or `rejected/noise`.

**Per-claim completion contract:**

- `Scored`: linked citation IDs, structured extraction, dimension values, final label, rationale, uncertainty/caveat wording, review status, and score snapshot.
- `Ready-to-score`: enough linked, identity-confirmed extraction exists to score, but the score has not been applied yet.
- `Source-blocked`: blocker kind and next action are known, such as identity mismatch, missing source, missing extraction, weak claim support, safety/regulatory source gap, or low-value/noise.
- `Parked/backlog`: may be useful later but is intentionally excluded from current public scoring, with a reason and revisit trigger.
- `Rejected/noise`: mismatch, duplicate, unsupported, non-product-relevant, or too low signal to preserve as evidence.

**Scoring completion plan:**

| Step | Work | Completion signal |
|------|------|-------------------|
| 1. Keep public pages honest | Make evidence-map cells and intervention detail pages distinguish scored evidence from insufficient, review-only, parked, and source-blocked states. Repeated placeholder-looking values such as old `2.1` and `3.1` patterns must not read as final scores without rationale. | Public pages never present review-only or source-blocked values as finished scores. |
| 2. Lock the scoring contract | Confirm score dimensions, weights, bands, review statuses, methodology copy, public wording, AU/TGA/product caveats, and snapshot/audit behavior. Every score stays scoped to a claim/source packet, not a supplement-wide recommendation. | Tooling cannot save a public score without dimension values, final label, rationale, linked citations, review status, and snapshot/audit trace. |
| 3. Account for the whole backlog | Run `npx tsx scripts/local-score-worklist.ts --limit 20` before each batch. Split every unscored cell by blocker type and recommended next action. | Worklist and `npx tsx scripts/local-catalog-quality.ts` explain every active claim without mystery buckets. |
| 4. Repair identity and claim links | Resolve identity warnings before scoring. Confirm, reassign, reject, or park sources when the source title/metadata points to a different intervention or scoped claim. | Identity-blocked accepted candidates no longer prevent source packets from becoming extraction-ready. |
| 5. Build structured source packets | Prioritize high-visibility public cells, safety/regulatory claims, high-quality reviews/trials, and interventions with many public claims. Capture design, population, comparator, endpoint, effect direction, practical impact, limitations, adverse events, regulatory/product caveats, and exact citation IDs. Avoid peptide sourcing, route, reconstitution, injection, cycling, dosing, or self-administration detail. | Each repaired claim becomes ready-to-score, remains source-blocked with a narrower blocker, or is intentionally parked/rejected. |
| 6. Score ready batches | Score one intervention/outcome group at a time. Use dry-run/draft output first, apply only when the packet supports the scoped claim, and capture component values, label, rationale, caveats, review status, and snapshot. Use `AI reviewed` only when traceability and safety/caveat rules are preserved; use `Human reviewed` only after explicit human confirmation. | No ready-to-score rows are left idle after each batch. |
| 7. Calibrate across the map | Compare similar evidence packets so weak, limited, moderate, and strong mean the same thing across interventions/outcomes. Spot-check high-impact examples such as creatine/strength, omega-3/lipids, caffeine/endurance, vitamin D/safety, zinc/immune, and peptide/regulatory rows. | Sampled rows have consistent labels, component scores, caveats, and "what would change the score" language. |
| 8. Close leftovers deliberately | Park weak-but-potentially-useful leads with a revisit reason. Reject clear noise, mismatches, unsupported claims, duplicates, irrelevant medical literature, and low-signal rows. | The leftover queue is intentionally small, explainable, and suitable for manual spot-checking. |
| 9. Verify local completion | Re-run the score worklist, catalog quality check, and public-page spot checks across strong, moderate, limited, weak, insufficient, safety, regulatory, parked, and source-blocked examples. | No unexplained default-looking public scores, no unprocessed ready-to-score rows, no score snapshot gaps, and every active local claim is accounted for. |

**Working rule:** do not try to exhaustively extract all linked references. For each claim, extract enough high-quality, identity-confirmed sources to support an honest scoped score, then park or reject the rest with a reason.

**Done when:** every active local claim is scored, parked/backlog, source-blocked, or rejected/noise with an explainable reason, and public pages no longer show placeholder-looking scores as if they are final evidence.

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
