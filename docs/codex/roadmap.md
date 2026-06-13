# Roadmap: Live Operations And Evidence Product Growth

Last updated: 2026-06-13

## Target

Operate Apex Lifespan as a credible, auditable public evidence intelligence product for supplements, peptides, and healthspan interventions. The product should help users understand claim-specific evidence strength, safety context, regulatory context, uncertainty, and what would change confidence.

Apex scores scoped claims, not compounds. It must not become a naive supplement leaderboard.

Reference detail: `docs/codex/reference/evidence-product-roadmap-reference.md`.

Archived launch roadmap: `docs/codex/archive/roadmap/2026-06-13-fully-live-end-product.md`.

Archived trust-polish backlog: `docs/codex/archive/roadmap/2026-06-13-trust-polish-backlog.md`.

## Current Baseline

- Public URL: `https://apex-lifespan.vercel.app`.
- Public data mode: database-backed production reads.
- Public routes and dashboard remain read-only.
- Authenticated operator workflows are available to approved operators.
- Scheduled ingestion evidence is ready and monitored; source-candidate promotion remains explicit and human-owned.
- Post-launch review scheduled: Sunday, June 14, 2026 at 2:00 PM Australia/Brisbane.
- Trust-polish work shipped on 2026-06-13: methodology page, public changelog, prototype notice, composite-score tooltips, score-label directionality, evidence-depth badges, evidence-map legend, operator-mode relabeling, human-review tooltip, feedback intake, and `/interventions/[slug]` detail pages.

## Principles

- Every score applies to a specific intervention, dose/form, population, outcome, comparator, duration, and evidence base.
- Every public medical claim should remain citation-linked and uncertainty-aware.
- Draft extraction, citation checking, human review, and clinical guideline endorsement are separate concepts.
- Product quality, regulatory status, and efficacy are separate concepts.
- Peptides, research chemicals, injectables, hormone-like agents, SARMs, and drug-like geroprotectors are therapeutic/regulatory watchlist items, not ordinary supplement recommendations.
- Evidence-depth wording must distinguish "not yet extracted" from "searched and no credible evidence found."

## Operations Checkpoints

These protect the live product without blocking normal local iteration. They become blockers only if they uncover launch safety, auth, data integrity, privacy, or medical-claim trust issues.

1. [ ] Complete the 24-48 hour post-launch review.
   Cadence: one-time launch checkpoint.
   Done when: `docs/codex/post-launch-review-template.md` is filled with evidence from the scheduled review, issues are recorded, and rollback/disable decisions are explicit.
   Latest state: scheduled for Sunday, June 14, 2026 at 2:00 PM Australia/Brisbane.
   Validate with: public smoke, operator smoke, operations readiness, scheduled ingestion dry-run, review notes.

2. [ ] Maintain stabilization checkpoints after meaningful iteration batches.
   Cadence: recurring before production deploys, PRs, handoffs, or larger roadmap transitions; not required before every small local edit.
   Done when: current local work is reviewed and organized without staging unrelated dirty work.
   Latest state: production hotfix `68981fe` is on `main`; current branch still has substantial uncommitted roadmap/onboarding/trust-polish work.
   Validate with: `git status -sb`, focused diffs, targeted tests, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit` when relevant to the batch.

## Ordered Product Steps

1. [x] Sprint 1: finish trust polish and UI consistency.
   Latest state: immediate trust-polish backlog is implemented and archived.
   Validate with: focused render tests, accessibility spot checks, `npm run test`, `npm run lint`, `npm run typecheck`, local browser QA.

2. [ ] Sprint 2: harden the data model for evidence, scores, and review history.
   Done when: interventions, claims, source packets, extracted evidence rows, score snapshots, score history, review events, changelog entries, products, safety alerts, and regulatory statuses have stable schemas and migration coverage.
   Latest state: additive schema/migration foundations exist for source packets, source-packet references, claim-study relevance links, claim score snapshots, score history, review events, and public changelog entries. Remaining work: backfill/import helpers, dashboard/detail hydration from the new tables, and operator workflows that write review events and score snapshots.
   Validate with: Prisma migration review, `npm run db:validate`, `npm run db:generate`, data-mode smoke, dashboard/detail hydration tests.

3. [ ] Sprint 3: improve trial watcher relevance and alerts.
   Done when: trial records distinguish direct match, combination product, related outcome only, wrong population, unreviewed lead, results posted, completed/no results, and terminated/unknown; trial alerts do not auto-promote evidence.
   Latest state: live ClinicalTrials.gov preview has relevance labels; persistent alert workflows and score-change links need design.
   Validate with: clinical-trials integration tests, trial relevance tests, source-candidate dry-runs, changelog preview tests.

4. [ ] Sprint 4: make safety and regulatory context first-class.
   Done when: safety domains, severity labels, regional regulatory flags, peptide-specific warnings, WADA/sport-risk flags, and product-quality/regulatory separation are visible and filterable.
   Latest state: safety center and AU/TGA context exist; region-specific expansion and safety-domain modeling remain open.
   Validate with: safety/regulatory tests, public peptide page content checks, `npm run regulatory:review`, public smoke.

5. [ ] Sprint 5: build Product Label Analyzer v2.
   Done when: label parsing distinguishes ingredient normalization, doses, proprietary blends, duplicate/high-dose warnings, certifications, product-quality score, demo/verified status, AU/TGA status, and efficacy evidence mapping.
   Latest state: demo product signals exist; demo status and quality-vs-efficacy separation need stronger UI and tests.
   Validate with: parser tests, product-signal tests, UI render tests, privacy review.

6. [ ] Sprint 6: expand interventions slowly and deeply.
   Done when: the next 5-10 interventions enter through onboarding/review-kit workflows with scoped claims, citation-linked source packets, safety/regulatory caveats, and explicit review status.
   Latest state: current launch coverage is intentionally small; pending source candidates remain backlog, not public evidence.
   Validate with: `npm run onboarding:guide -- --summary`, `npm run coverage:review -- --env-file .env.vercel.preview.local --summary`, source-packet review, public smoke.

7. [ ] Add analytics, feedback, and quality instrumentation.
   Done when: privacy-safe product/operations KPIs distinguish public usage, operator workflow health, ingestion health, evidence quality, and user feedback.
   Latest state: operations monitors exist; product analytics/KPI layer is not defined.
   Validate with: KPI definitions, privacy review, dashboard/report output, monitoring links.

## Guiding Rule

Apex Lifespan should reward boring evidence, penalize hype, and make uncertainty visible. The best version of the product is not the largest compound database; it is the one where every score is scoped, auditable, conservative, and useful.
