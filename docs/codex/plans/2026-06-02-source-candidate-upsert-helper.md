# Source Candidate Upsert Helper

- Goal: Add a gated server-side helper for persisting mapped live-source candidates without changing public GET preview routes.
- Constraints: Keep the app public read-only, do not auto-persist live previews, and do not reset reviewer decision/review status during repeated candidate upserts.
- Done condition: A data-layer helper upserts source candidates by dedupe key, preserves review disposition on update, and has tests for empty input, create payloads, and update payload safety.
- Files likely touched: `src/lib/data/source-candidates.ts`, tests, `docs/codex/project.md`.
- Steps:
  - Add Prisma enum/source mapping for the domain `SourceCandidate` type.
  - Add an upsert helper that creates unreviewed pending candidates and updates only rediscoverable metadata on conflicts.
  - Test the helper with mocked Prisma calls.
  - Run targeted tests, full tests, lint, typecheck, build, and HTTP smoke.
- Risks: Accidentally turning public search into writes later; keep helper unreferenced by public routes.
