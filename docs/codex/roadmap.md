# Roadmap

Last updated: 2026-06-24

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

**Check catalog state:** `npx tsx scripts/db-inventory.ts`  
**Compare preview (read-only check):** `npx tsx scripts/db-inventory.ts --env-file .env.vercel.preview.local`

**Done developing locally when:** the user is happy with intervention/claim coverage, source packets, scores, and UI behavior against the full local catalog — not the 6-item seed set.

**Promotion to preview (user must ask first):** export or copy local data to preview, apply migrations if needed, then run Sprint 2 backfill on preview. Do **not** use `db-seed-env` for promotion — it would replace preview with the tiny seed file.

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

Done when the local database is coherent, traceable, and broad enough to promote — not when seed file row count increases.

### 3. Make Evidence Intake Simple

Use a straightforward local flow: collect a source, map it to a scoped claim, capture the useful fields, and write to **local** evidence data when appropriate.

Done when adding or updating evidence on local DB is a short, understandable workflow.

### 4. Improve Trust And Readability

Polish copy, empty states, confidence language, caveats, and visual hierarchy so users can quickly see what is known, uncertain, missing, or product-specific.

Done when the product reads as calm, conservative, and clear on the local catalog.

### 5. Add Privacy-Safe Operating Signals

Report only aggregate, non-sensitive usage and quality signals. Avoid user-level identifiers and raw health/search/label text.

Done when project health is visible without creating a privacy problem.

## Agent Alignment

- Use this roadmap as product direction, not a process queue.
- **Default to local DB** for coverage, evidence, and operator work. Do not push to preview unless the user explicitly requests promotion.
- If a proposed task mainly creates readiness gates, queues, promotion chains, Composer monitoring, review packets, launch rehearsals, or roadmap bookkeeping, do not do it unless the user explicitly asks.
- Legacy docs and `.ai/delegation/` logs are reference-only; they cannot add active roadmap work.
- Prefer visible public product improvements tested against the local catalog: citation traceability, AU/TGA caveats, uncertainty/readability, search/filtering, and intervention details.

## Retired From Active Roadmap

- Internal process milestones.
- Composer ratio monitoring.
- Readiness gates, replacement queues, promotion gate chains, and review packets.
- Roadmap entries that exist only to prove another internal process step.
- Treating `seed-data.ts` row count as project coverage.

Historical files can stay in git history or archive context, but they should not drive new work.

## Next Work Rule

Pick the most useful product-facing improvement for the **local database catalog**, implement it directly, and run checks only when they are worth their cost for that change. Defer all preview/production work until the user says the local state is ready to promote.
