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

Turn accepted sources and draft claim clusters into honest, traceable evidence scores for the local catalog. This is a real milestone, not a one-button pass, because scoring has to separate source readiness, claim confidence, safety/regulatory caveats, public display language, and review status. Do this against the local database first; do not promote scored results to preview/production until the user explicitly asks.

**Current local scoring status (2026-07-02, read-only worklist):**

- `21/477` public claim cells are scored with substantive source extraction.
- `456/477` claim cells still need scoring work.
- `0` claim cells are ready to score now because the first ready batch has been scored into AI-draft public states with score snapshots.
- `456` claim cells are source-blocked; remaining scoring work is source extraction/link repair before score assignment.
- `0` default-looking public scores and `0` score snapshot gaps are currently reported by the local score worklist.

**Scoring finish line:** every active local claim is either scored from a traceable source packet, parked/backlog with a reason, source-blocked with a concrete next action, or rejected/noise. Completion is proven locally by the score worklist and catalog-quality checks accounting for all claims, plus public-page spot checks showing no placeholder-looking scores as final evidence.

**Scoring objective:** complete local scoring for the `477` active public claim cells by moving each one into exactly one accountable state: `scored`, `ready-to-score`, `source-blocked`, `parked/backlog`, or `rejected/noise`. The current bottleneck is not the score formula; it is source identity, source extraction, and claim-support repair for the `456` source-blocked cells.

**Per-claim completion contract:**

- `Scored`: has linked citation IDs, structured extraction, dimension values, final label, rationale, uncertainty/caveat wording, review status, and a score snapshot.
- `Ready-to-score`: has enough linked, identity-confirmed extraction to score but has not been scored yet.
- `Source-blocked`: has a blocker kind and next action, such as identity mismatch, missing source, missing extraction, weak claim support, safety/regulatory source gap, or low-value/noise.
- `Parked/backlog`: may be useful later but is intentionally excluded from current public scoring, with a reason and revisit trigger.
- `Rejected/noise`: is mismatch, duplicate, unsupported, non-product-relevant, or too low signal to preserve as evidence.

**Scoring completion map:**

1. **Keep public scores honest while scoring is incomplete.**
   - Evidence-map cells and intervention pages must distinguish scored evidence from insufficient evidence, review work, parked research, and source-blocked claims.
   - Placeholder-looking public values such as repeated `2.1` and `3.1` must either gain real scored rationale or be shown as review/source-work states.
   - Low-confidence but real evidence can stay visible as weak or limited evidence; unsupported/noise rows should not masquerade as low-confidence scores.
   - Done when public pages never present review-only or source-blocked values as finished scores.

2. **Lock the scoring contract and save rules.**
   - Confirm the score dimensions: Directness, Rigor, Impact, Safety, Measurability, Low regulatory risk, Low hype risk, and product caveat context.
   - Confirm composite weights, evidence bands, final labels, review statuses, score snapshots, public wording, and methodology copy.
   - Keep every score scoped to a specific claim and source packet, not a supplement-wide recommendation.
   - Treat safety, regulatory/product status, overclaim risk, uncertainty, and AU/TGA/product-level caveats as first-class constraints.
   - Done when a score cannot be saved without dimension values, final label, rationale, linked citations, review status, and snapshot/audit trace.

3. **Make the scoring backlog fully measurable.**
   - Count every active local claim as scored, ready-to-score, score-review, source-blocked, parked/backlog, or rejected/noise.
   - Split source-blocked work into blocker types: identity mismatch, missing source record, missing structured extraction, weak claim support, safety/regulatory source gap, or low-value/noise.
   - Group work by intervention and outcome with current score, source packet completeness, top citations, review status, identity warnings, and next action visible.
   - Done when `npx tsx scripts/local-score-worklist.ts --limit 20` and `npx tsx scripts/local-catalog-quality.ts` explain the whole backlog without mystery buckets.

4. **Repair source identity and claim/source links first.**
   - Resolve intervention identity warnings before scoring, because a correct score on the wrong intervention is worse than no score.
   - Link accepted candidates to the correct scoped claim, or reassign/reject them when the title/source supports a different intervention.
   - Keep source-led automation conservative: it can confirm visible identity, reassign clear source mentions, reject clear mismatches, and park ambiguous literature.
   - Done when identity-blocked accepted candidates no longer prevent source packets from becoming extraction-ready.

5. **Build structured source packets.**
   - Prioritize high-visibility public cells, safety/regulatory claims, high-quality review/trial leads, and interventions with many public claims.
   - For each source packet, repair PubMed, ClinicalTrials, DOI, NIH/official safety, and regulatory/product references as needed.
   - Capture structured extraction: study design, population, comparator, endpoint, effect direction, practical impact, limitations, adverse-event context, regulatory/product caveats, and exact citation IDs.
   - Confirm intervention identity and scoped-claim support before scoring.
   - Avoid peptide sourcing, route, reconstitution, injection, cycling, dosing, or self-administration guidance.
   - Done when each repaired claim becomes ready-to-score, remains source-blocked with the next blocker, or is parked/rejected.

6. **Score ready packets in batches.**
   - Score one intervention/outcome group at a time so similar claims use consistent evidence thresholds.
   - Start with the highest-yield ready packets: strong review/trial evidence, public high-interest rows, and claims with existing source packets.
   - Use the operator score editor or local score draft dry-run before applying any update.
   - Apply `AI reviewed` only when citation traceability, uncertainty labels, AU/TGA caveats, product-level limits, and no-medical-advice boundaries are preserved.
   - Use `Human reviewed` only after explicit human confirmation.
   - Capture score snapshots so future changes are auditable.
   - Done when each ready batch moves to scored, parked/backlog, or rejected/noise before the next batch starts.

7. **Calibrate the scored catalog.**
   - Compare similar intervention/outcome groups so strong, moderate, limited, weak, safety, and regulatory labels mean the same thing across the map.
   - Spot-check high-impact examples such as creatine/strength, omega-3/lipids, caffeine/endurance, vitamin D/safety, zinc/immune, and peptide/regulatory rows.
   - Reconcile any score whose public label, component values, citations, or caveats feel inconsistent.
   - Done when sampled rows show consistent scoring logic and clear "what would change the score" language.

8. **Close leftover buckets deliberately.**
   - Park weak-but-potentially-useful leads with a clear reason.
   - Reject clear noise, mismatches, unsupported claims, duplicates, and non-product-relevant medical literature.
   - Keep only a small spot-check bucket for ambiguous rows that need human judgment rather than automation.
   - Done when the leftover queue is intentionally small and explainable.

9. **Verify completion locally.**
   - `npx tsx scripts/local-score-worklist.ts --limit 20` shows no unexplained default-looking public scores and no ready-to-score rows left unprocessed.
   - `npx tsx scripts/local-catalog-quality.ts` accounts for every claim state.
   - Public evidence map and intervention detail pages are spot-checked for strong, moderate, limited, weak, insufficient, safety, regulatory, parked, and source-blocked examples.
   - Promotion stays out of scope until the user explicitly asks to move local scored data to preview/production.

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
