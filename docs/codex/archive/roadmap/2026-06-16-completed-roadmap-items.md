# Archived Roadmap Items: Completed Foundations

Archived on 2026-06-16 while converting `docs/codex/roadmap.md` into completable active goals. This file preserves completed and historical progress so the active roadmap can focus on work that still has a measurable finish line.

## Completed Public/Product Foundations

- Fully-live launch and trust-polish work shipped and was archived.
- Public production reads are database-backed.
- Public routes and the public dashboard remain read-only.
- Operator auth is configured; production writes remain behind explicit approval checkpoints.
- Stabilization checkpoints are established before production deploys, PRs, handoffs, or large roadmap transitions.

## Completed Evidence Model Foundations

- Schema and migration foundations exist for source packets, packet references, claim-study links, score snapshots/history, review events, trial alerts, and changelog entries.
- Dashboard/detail hydration can read normalized packet, relevance, score, and history rows.
- Claim packet review and source-candidate promotion workflows can write review/audit/changelog state transactionally in approved operator paths.
- Preview migration/seed smoke passed against `.env.vercel.preview.local` before this archive note was created.

## Completed Read-Only Review Agent Foundations

- The local/operator-only Apex Review Agent can build read-only packets, send through the local sidecar, show an action queue, collect source leads explicitly, persist guidance, and support loop dry-runs with search expansion.
- The source-discovery planner can produce bounded PubMed and ClinicalTrials.gov lead plans from claim gaps without queue writes.
- Candidate clustering can group sibling/duplicate PMID/NCT identities, surface reference-match context, rank review order, and emit no-write inspection commands.
- Evidence draft packets can compile field-level provenance, unknown reasons, blockers, target rows, source-packet readiness, dry-run diffs, uncertainty labels, and no-write publication flags.
- Evidence Draft Review can surface before/after field status, target-table grouping, reviewer-note handoffs, route readiness, apply-readiness preflights, transaction-boundary previews, audit previews, and rollback/verification plans without enabling real writes.
- The operating monitor and Action Queue can route read-only follow-up for source failures, duplicate identities, stale gaps, needs-more-sources routes, draft blockers, promotion blockers, and bounded throughput proxies.
- Copy-safe handoffs exist for selected monitor signals, route readiness, lead-fetch assignments, diagnostic assignments, reviewer notes, and missing telemetry explanations.

## Completed Source-Packet Impact Loop

- Completed on 2026-06-16 after read-only verification of the local evidence-impact bridge.
- `npm run evidence:apply-ready -- --json` reported `wouldApply: 0`, `blocked: 0`, `scanned: 2`, and two skipped `already-promoted` packets.
- `npm run ingest:sources -- --candidate-curation-handoff --candidate-curation-handoff-status ready` reported two ready public source packets: PubMed `42141930` for `creatine-strength` and PubMed `42198398` for `ashwagandha-safety`.
- A read-only Prisma audit lookup found matching `sourceCandidate.publicEvidencePromotion` audit events for both ready dedupe keys.
- The audit notes preserve AI-reviewed status, claim scope, uncertainty, no individualized medical advice, and no product-level AU/TGA inference.

## Completed Candidate Lead Batch

- Completed on 2026-06-16 with a one-candidate read-only batch selected from `npm run evidence:apply-ready`.
- Selected candidate: ClinicalTrials.gov `NCT01169259`, `Vitamin D and Omega-3 Trial (VITAL)`, claim `omega-3-cv-events`, triage `100/100`, review status `Unreviewed AI draft`.
- `npm run ingest:sources -- --candidate-review-packet <b64-key>` inspected the packet and showed `acceptedReferenceMatches=0`, `acceptReferenceReady=false`, and no candidate/extraction/promotion writes.
- `npm run ingest:sources -- --candidate-reference-matches <b64-key>` confirmed zero curated reference matches and emitted a draft reference id `ref-clinicaltrials-gov-nct01169259`.
- `npm run ingest:sources -- --candidate-siblings <b64-key>` inspected eight sibling/context rows, including one already rejected sibling and several pending related omega-3 cardiovascular candidates.
- `npm run ingest:sources -- --prepare-candidate-reference <b64-key>` produced a read-only missing-reference preview with `write=false`; the next action remains explicit approval before `--write-candidate-reference`.
- No candidate accept/reject write, reference write, claim-link write, extraction write, score write, or public evidence write was performed.

## Completed Evidence Draft Review Prototype Goal

- Completed on 2026-06-16 after read-only packet inspection and Review Agent validation.
- `npm run codex:review-loop -- --dry-run --print-packet` showed draft rows with field provenance, target rows, source-packet readiness, route follow-ups, reviewer-note handoffs, approval preconditions, audit previews, transaction boundaries, rollback/verification summaries, and disabled write controls.
- The packet kept candidate decision, claim link, extraction, claim review, score snapshot/history, changelog/public evidence, and public promotion boundaries separate.
- Tests show coverage for complete proposed source packets, blocked packets with clear blocker routing, batch reviewer-note handoffs, batch source-packet readiness, batch approval preconditions, route readiness, and rollback/verification summaries.
- Validation passed: `npm run validate:review-agent` and `npx tsc --noEmit --pretty false`.
- No real apply controls, candidate decisions, extraction writes, claim review status changes, score snapshots/history, changelog writes, or public evidence writes were enabled.

## Completed Safety/Product Foundations

- Safety Center, AU/TGA context, regional review gaps, safety domains, severity labels, and peptide watchlist presentation exist.
- Product Label Analyzer v2 foundations handle major units/forms, duplicate rows, quality cues, product-profile matching, AU/TGA identifier states, and product-quality-vs-efficacy separation.
- Privacy-safe KPI definitions and aggregate schema exist; provider selection and real aggregate outputs remain active roadmap work.

## Archived Because

These items are no longer useful as active roadmap tasks because their current deliverables exist. Remaining work is represented in the active roadmap as measurable goals with explicit completion criteria, validation commands, and stop/ask boundaries.
