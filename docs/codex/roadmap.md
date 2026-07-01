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

- `8/477` public claim cells are scored.
- `469/477` claim cells still need scoring work.
- `67` claim cells are ready to score now because their source packets are complete enough for an operator pass.
- `402` claim cells are source-blocked; most remaining scoring work is source extraction/link repair before score assignment.
- `0` default-looking public scores and `0` score snapshot gaps are currently reported by the local score worklist.

**Goal:** every active local claim should end in one clear public-safe state: scored with traceable source packet and review status, parked/backlog with a reason, source-blocked with next action, or rejected/noise.

1. Lock the scoring model users should trust:
   - Keep the visible dimensions understandable: directness, rigor, impact, safety, measurability, regulatory/product caveat, and hype/overclaim risk.
   - Document how those dimensions produce the composite score, evidence band, and public label.
   - Make clear that scores are scoped to a claim and source packet, not to a whole supplement as a blanket recommendation.
   - Confirm the public band language for weak, limited, moderate, strong, insufficient-evidence, and regulatory-concern outcomes.

2. Keep the score-readiness inventory authoritative:
   - Count local claims by scored, unscored, default-looking score, source-packet incomplete, source-packet complete, parked/backlog, and rejected/noise.
   - Flag repeated starter-looking scores such as `2.1`, `3.1`, or other placeholder/default patterns as scoring-review work unless they have an explicit scored rationale.
   - Separate "ready to score now" from "needs source extraction/linking first."
   - Use `npx tsx scripts/local-score-worklist.ts --limit 20` as the local read-only run sheet before and after scoring batches.

3. Finish the ready-to-score batch first:
   - Work through the `67` ready rows before touching source-blocked rows.
   - Score complete packets one intervention/outcome group at a time so labels, evidence bands, and caveats stay consistent.
   - Use assisted suggestions only as a draft aid; the saved score still needs operator review and citation traceability.
   - Park or reject any "ready" row that proves too thin, mismatched, product-specific, or outside the current evidence boundary.

4. Complete source packets for source-blocked rows:
   - Prioritize high-visibility public cells, complete-enough review/trial leads, safety/regulatory claims, and interventions with many user-facing claims.
   - Add or repair structured extraction for linked PubMed, ClinicalTrials, DOI, and official safety/regulatory references.
   - Confirm the source actually supports the scoped claim and intervention identity before scoring.
   - Keep rows source-blocked, parked, or rejected when the packet cannot support an honest public score.

5. Keep the scoring worklist practical:
   - Prioritize high-visibility public cells, complete source packets, high-quality reviews/trials, safety/regulatory claims, and interventions with many user-facing claims.
   - Group by intervention and outcome so a scoring pass can finish one area at a time.
   - Show the current score, source packet completeness, top citations, review status, and the next scoring action.

6. Polish the local scoring editor:
   - Show the source packet beside the score dimensions.
   - Allow editing each scoring dimension and previewing the composite, band, and label before saving.
   - Save as `AI reviewed` only when citation traceability, uncertainty labels, AU/TGA caveats, product-level limits, and no-medical-advice boundaries are preserved.
   - Use `Human reviewed` only after explicit human confirmation.

7. Keep assisted scoring suggestions conservative:
   - Generate suggested dimension scores and rationale from the linked source packet.
   - Require operator review before saving suggestions.
   - Surface uncertainty, mixed evidence, source limitations, and safety/regulatory caveats instead of smoothing them away.

8. Improve public score representation:
   - Do not make starter/default scores look like final evidence.
   - Distinguish scored evidence, review work, parked/backlog, insufficient evidence, and unassessed cells.
   - Make low-confidence scored claims useful without implying clinical advice or broad supplement endorsement.
   - Apply the same source-work and audit-gap language on intervention detail pages, not only the evidence map.

9. Verify scoring quality before promotion:
   - Local catalog quality checks should report no unexplained default-looking public scores.
   - Public smoke should pass against the local database.
   - Spot-check representative high, medium, low, safety, and regulatory claims on the public evidence map and intervention detail pages.
   - Re-run the score worklist until ready-to-score, source-blocked, parked, rejected, and scored counts explain the whole local catalog.

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
