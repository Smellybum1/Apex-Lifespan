# Data Model Foundations Plan

Date: 2026-06-13

## Goal

Advance roadmap Sprint 2 by adding additive Prisma schema foundations for product-grade evidence and review history without changing current public read behavior.

## Scope

- Add normalized tables for source packets, claim-study relevance links, claim score snapshots, score history, review events, and public changelog entries.
- Keep existing dashboard hydration and seed-backed public UI behavior unchanged.
- Keep all new rows optional/empty by default so migration is additive and safe.

## Non-Goals

- No production deploy.
- No public write flows.
- No auto-promotion of source candidates.
- No automated human-review marking.
- No data backfill beyond schema readiness.

## Validation

- `npm run db:validate`
- `npm run db:generate`
- Focused schema/read tests if any compile surface changes.
- `npm run typecheck`
