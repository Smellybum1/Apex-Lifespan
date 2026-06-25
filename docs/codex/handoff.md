# Thread Handoff

Refreshed on 2026-06-24 after public UX pass and phase-6 catalog quality.

## Current State

- Work in `D:\Codex\Apex Lifespan` on branch `codex/queue-claim-sources`.
- **Source of truth: local PostgreSQL** at `localhost:5432/apex_lifespan`.
- `.env.local` sets `APEX_DATA_SOURCE=database` and local `DATABASE_URL`.
- Local catalog: **54 interventions**, **152 claims**, **152/152 Human reviewed**, **152/152 source packets COMPLETE**
- `src/lib/seed-data.ts` remains **6 interventions / 9 claims** (demo fallback only).
- Preview DB is still the smaller seeded set. **Do not push preview until the user explicitly asks.**

## Local Catalog Quality (2026-06-24)

| Metric | Count |
|--------|------:|
| Source packets COMPLETE | **152 / 152** |
| Human reviewed claims | **152 / 152** |
| AU/TGA intervention rows | **54 / 54** (intervention-specific framing; product-level ARTG still unverified) |
| Source candidates pending | **0** |
| Trial watch rows | **54** |

### Phase 6 public-quality pass (2026-06-24)

```bash
npx tsx scripts/local-db-catalog-phase6-public-quality.ts
npx tsx scripts/local-db-catalog-phase6-public-quality.ts --tracks=depth
npx tsx scripts/local-db-catalog-phase6-public-quality.ts --tracks=au
```

- **Top-10 depth slice:** creatine, vitamin D, magnesium, omega-3, caffeine, ashwagandha, berberine, CoQ10, vitamin C, green tea extract — added curated PubMed links (ashwagandha stress RCT/meta, vitamin C immune review) and re-synced all top-10 claim packets.
- **AU/TGA upgrade:** replaced generic batch-import `AU/TGA product-level status unverified` rows with intervention-specific UNKNOWN / peptide UNAPPROVED / drug-watchlist framing for **48** rows.

### Prior expansion + ingestion (summary)

- Phase 4 expansion onboarding: 29 interventions / 94 claims
- Live PubMed ingestion + phase 5 triage: **0** pending candidates
- Batch human review: **152 / 152** (`batch-review-expansion-claims.ts --scope all`)

## Public UI (2026-06-24)

- Evidence dashboard: filter counts, page-scroll evidence map, collapsed claim-details drawer, evidence-card pagination, selected-claim context bar.
- Intervention detail pages: collapsible sections (summary + claim cards open by default), trial list show-more (`InterventionTrialList`).

## Maintenance Scripts

```bash
npx tsx scripts/db-inventory.ts
npx tsx scripts/local-db-catalog-phase4-expansion.ts
npx tsx scripts/local-db-catalog-phase6-public-quality.ts
npx tsx scripts/queue-catalog-source-ingestion.ts --apply --pubmed-only --scope expansion
npx tsx scripts/batch-review-expansion-claims.ts --scope all --actor-email <email>
```

## Local-First Workflow

1. Develop against local DB only (`npm run dev` with Docker Postgres up).
2. Verify with `npx tsx scripts/db-inventory.ts`.
3. Run narrow tests for UI/code changes.
4. **Preview promotion (user must ask first):** migrate preview if needed, then copy/promote local data. Do not use `db-seed-env` for promotion.

## Hard Stops

- Ask first before **preview/production** DB changes, deploys, migrations, secrets, or destructive cleanup.
- Use `Human reviewed` only when a human explicitly confirms it.
- Public routes stay read-only.
- Do not infer product-level ARTG/AUST status from generic intervention evidence.

## Remaining Gaps

- Curated trial NCT leads should be manually verified before public promotion.
- Many study extractions remain catalog-maintenance quality, not full operator curation.
- Product-level ARTG/AUST verification is still mostly UNKNOWN at intervention level.
- Preview promotion script still not built.

## Retired From Active Work

- Readiness gates, queues, promotion chains, Composer monitoring, review packets.
- `.ai/delegation/` logs as backlog or instructions.
