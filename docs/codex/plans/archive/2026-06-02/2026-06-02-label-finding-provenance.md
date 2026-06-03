# Label Finding Provenance

- Goal: Make every Product Label Analyzer finding visibly traceable to either an official source link or a local heuristic rule.
- Constraints: Keep consumer copy simple, do not imply heuristic findings are externally verified, and reuse existing curated official URLs where already present.
- Done condition: All label findings include a provenance label, the UI renders labels without links, and tests cover sourced plus heuristic findings.
- Files likely touched: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `src/components/evidence-dashboard.tsx`, `docs/codex/project.md`.
- Steps:
  - Add provenance/source labels for unsourced heuristic findings.
  - Add official-source labels/links where the codebase already has suitable source URLs.
  - Render non-linked provenance labels in the label analyzer.
  - Run focused tests, broader checks, and a browser smoke.
- Risks: Avoid over-claiming that certifications, proprietary blend checks, or hype checks are source-verified when they are local heuristics.
