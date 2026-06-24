# Product Analytics Aggregate Path

Last updated: 2026-06-20

This is the reviewed Goal 3 path for privacy-safe analytics work while Apex Lifespan has no approved third-party analytics provider and no production telemetry write approval.

## Decision

Use a local-only reviewed aggregate export path for current product analytics reporting. Do not add a third-party provider, send production telemetry, store user-level health/search/label text, or infer public usage values from raw logs without an explicit future approval.

Public usage metrics remain schema-defined but provider-gated. Operator workflow health, ingestion health, evidence quality, feedback volume, and publication-latency proxies may be reported from reviewed aggregate rows when they pass the KPI privacy review and aggregate validator.

## Review Commands

```powershell
npm run analytics:kpis -- --privacy-review
npm run analytics:kpis -- --aggregate-schema
npm run analytics:kpis -- --validate-aggregate <aggregate-json-file>
```

The aggregate file must be a JSON array of rows or an object with a `rows` array. Each row stays aggregate-only: `metricId`, `value`, `dimensions`, `periodStart`, `periodEnd`, and `sourceLabel`.

## Reporting Coverage

- Public usage: blocked for real values until an approved privacy-preserving aggregate provider or equivalent reviewed aggregate source exists.
- Operator workflow health: reviewed aggregates from review events, changelog entries, trial alerts, and operator audit counts; no actor emails or user IDs.
- Ingestion health: scheduled ingestion and source-candidate aggregate counts; no raw abstracts, raw search payloads, or auto-promotion.
- Evidence quality: claim, source-packet, score snapshot, score history, and review-event aggregates; citation traceability and review status stay visible downstream.
- Feedback volume: public issue labels, state transitions, and metadata counts only; no raw issue bodies or private health details.
- Publication latency: report aggregate review queue age and score snapshot freshness as latency/freshness proxies until a dedicated publication-latency export is reviewed.

## Validation

The focused test `validates Goal 3 aggregate-only rows across every reporting area` in `src/lib/product-analytics-kpis.test.ts` exercises `validateProductAnalyticsAggregateRows` with representative aggregate-only rows for public usage schema, operator workflow health, ingestion health, evidence quality, feedback volume, and publication-latency proxies. Public usage metrics stay schema-defined and provider-gated; real public usage values still require an approved privacy-preserving aggregate provider.

## Boundaries

- Public routes and dashboard surfaces remain read-only.
- `Human reviewed` analytics evidence requires explicit human confirmation; Codex/local checks use audited review notes only.
- Any third-party analytics provider, production telemetry, user-level storage, database mutation, dependency change, or privacy boundary change needs explicit approval before execution.
- KPI outputs are operating metrics, not medical advice, evidence-quality proof, or product-level regulatory status.
