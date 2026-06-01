# AU Product Card Context

- Goal: Make product label cards clearer about market context versus Australia/TGA verification.
- Constraints: Keep the app public read-only, Australia-first, and avoid implying ARTG/AUST status without product-level evidence.
- Done condition: Seed and Prisma-backed product regions align, product cards expose product-market context, and AU status details are visible without overwhelming the default card.
- Files likely touched: `src/lib/seed-data.ts`, `prisma/seed.ts`, `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Remove the seed/Prisma product-region mismatch.
  - Add compact product-market and certification context to the label analyzer cards.
  - Expand the AU product chip with source-backed details.
  - Validate with tests, lint, typecheck, build, and a browser smoke check.
- Risks: Copy that says "AU-ready" could imply Australian authorization; use verification-pending language instead.
