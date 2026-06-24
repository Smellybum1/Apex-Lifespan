# Supplement Onboarding Command Reference

Reference-only command and implementation history. Do not read during startup or ordinary site iteration; start with `docs/codex/supplement-onboarding.md` and open this only for onboarding command details.

Use this flow to draft a new supplement/intervention without immediately publishing public evidence.

## Friction Before This Helper

- Add an intervention, claim scopes, references, study extraction, safety/regulatory notes, source-candidate jobs, and review evidence in separate places.
- Keep AU/TGA ingredient-level and product-level evidence separate.
- Queue source discovery only after the intervention/claim context exists.
- Accept/reject candidates, link claims, extract study metadata, and mark claim packets reviewed through separate human-owned steps.

## Dry-Run Draft

Run:

```bash
npm run onboard:supplement -- --name "Magnesium glycinate" --category "Vitamin/mineral" --synonym magnesium --form Capsule --claim "Sleep|Sleep quality support in adults with low magnesium intake."
```

The command prints:

- Intervention id, slug, category, synonyms, forms, and provisional safety/regulatory text.
- Draft claim ids and outcomes.
- A conservative TypeScript seed-data snippet for review.
- Claim-specific source-query plan with PubMed, ClinicalTrials.gov, safety, AU/TGA review, outcome-specific, and category-specific search bundles.
- AU/TGA product-status assistant with exact product identity gaps, evidence checklist, confidence rules, and search terms.
- Safety/watchlist automation with blocked/warning signals, required packet checks, and public wording blocks.
- Copy-safe post-draft handoff commands for seed-diff review, import-assistant preview, readiness, queue preview, status, AU/TGA review, full-text source next action, and local validation.
- Claim-scoped queue commands to run after the intervention and claims exist in seed/database data.
- Blocking review items and guardrail warnings.

If an exact product is already in scope, add optional product-level AU/TGA hints such as `--product-brand`, `--product-name`, `--aust-number`, `--artg-id`, `--sponsor`, and `--product-source-url`.

Use claim templates to avoid hand-writing common scopes:

```bash
npm run onboard:supplement -- --name "Magnesium glycinate" --category "Vitamin/mineral" --templates sleep,safety,lifespan
```

If no claim templates or custom claims are supplied, the planner now auto-applies conservative category defaults. For example, fatty acids start with safety, lifespan, lipid, cardiovascular-event, and inflammation draft scopes; ergogenic supplements start with safety, lifespan, strength, and endurance scopes. The generated packet labels which templates were auto-applied and which were merely suggested.

To save a local draft:

```bash
npm run onboard:supplement -- --name "Magnesium glycinate" --category "Vitamin/mineral" --claim "Sleep|Sleep quality support in adults with low magnesium intake." --write-draft
```

Drafts are written to `docs/codex/onboarding/<slug>.md`.

## One-Command Packet

Use the packet command when you want the current onboarding state in one read-only output instead of running the draft, seed-diff, import-assistant, review-packet, status, and full-text commands one by one.

For a new supplement concept:

```bash
npm run onboarding:packet -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep --summary
```

For an existing seed/database supplement:

```bash
npm run onboarding:packet -- --supplement creatine --summary
```

For several new supplement concepts, keep each packet isolated with the batch fixture:

```bash
npm run onboarding:packet -- --batch-file docs/codex/onboarding/examples/batch-onboarding.json --summary
```

For several existing seed/database supplements:

```bash
npm run onboarding:packet -- --supplements creatine,vitamin-d --summary
```

Add `--env-file <non-production-env-file>` when you want the existing-supplement packet to use approved database-backed source tracking, and add `--fulltext-inventory-file <path>` when a reviewed local full-text inventory exists. Without database-backed source tracking, the packet reports source conviction as unavailable rather than inventing candidate evidence.

The draft-mode packet combines the generated draft, seed-diff/import-assistant summary, review-kit file list, explicit post-review source-queue command, and full-text source-gate next action. The existing-mode packet combines status, readiness, review-packet/source-conviction summary, candidate-review autopilot, full-text source-gate summary, post-onboarding monitor, and next-action commands. When no full-text inventory has started, the packet flattens the approval-false all-source review-kit and inventory-progress follow-up commands into its command list. When `--fulltext-inventory-file` points to a connector-review-ready inventory, the packet also flattens the bundled connector prep-kit writer, fixture follow-ups, connector-review preview, connector implementation-plan preview, and approval-packet preview into its command list so the next local artifact steps are visible without opening the nested full-text planner first.

Batch packet modes wrap the same single-supplement packet shape per supplement. The batch summary reports ready/warning/blocked counts and flattens command previews with supplement-prefixed labels for supplement-specific work, but each supplement keeps its own packet summary, status, next action, and source/review context. Shared full-text source setup commands, such as the all-source review kit, inventory progress, connector prep kit, and fixture follow-ups, are listed once because they operate on the shared local source inventory rather than on one supplement record.

The packet command itself is read-only. It does not edit seed data, write database rows, queue sources, accept/reject candidates, extract studies, mark claims reviewed, approve connectors, fetch full text, or promote evidence. Commands inside the packet are labeled as read-only, local-file-write, or explicit-write-after-review.

## One-Command Guide

Use the guide command when you want the shortest "what should I run next?" answer without losing the packet context.

For a new supplement concept:

```bash
npm run onboarding:guide -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep --summary
```

For an existing seed/database supplement:

```bash
npm run onboarding:guide -- --supplement creatine --summary
```

For several new supplement concepts:

```bash
npm run onboarding:guide -- --batch-file docs/codex/onboarding/examples/batch-onboarding.json --summary
```

For several existing seed/database supplements:

```bash
npm run onboarding:guide -- --supplements creatine,vitamin-d --summary
```

Add `--env-file <non-production-env-file>` for approved database-backed source tracking, and add `--fulltext-inventory-file <path>` when a reviewed local full-text inventory exists. Existing-supplement guides can recommend the approval-false all-source full-text review kit when no inventory has started. Existing-supplement batch guides reuse the same reviewed inventory path across the isolated packet previews and can surface connector-prep or fixture follow-up commands when the full-text gate is ready.

The guide is a thin read-only orchestration layer over `onboarding:packet`. It summarizes the packet, recommends one safe next command, and keeps the rest of the command queue ordered with labels for read-only, local-file-write, and explicit-write-after-review steps. It does not edit seed data, write database rows, queue sources, accept/reject candidates, extract studies, mark claim packets reviewed, approve connectors, fetch full text, or promote evidence.

## Local Rehearsal

To rehearse the whole onboarding shape for a new supplement concept without writing anything:

```bash
npm run onboarding:rehearsal -- --name "Magnesium glycinate" --category "Vitamin/mineral" --claim "Sleep|Sleep quality support in adults with low magnesium intake." --summary
```

Use `--markdown` for a local packet that includes the draft, friction assessment, guardrail review, queue preview, readiness commands, review-packet shell, and `onboarding:next` command to run after reviewed seed/database records exist.

The summary includes a `friction` block with a `0-100` score, tier, and itemized next actions for claim scope, guardrails, safety/watchlist review, AU/TGA product status, source-search setup, and the full-text source gate. Lower scores mean smoother setup. Any blocked item makes the rehearsal tier `blocked` so peptide/watchlist or missing-claim cases cannot look deceptively ready.

The rehearsal is local and read-only. It does not write seed/database rows, queue source jobs, ingest sources, accept/reject candidates, extract studies, mark claim packets reviewed, promote public evidence, or fetch full text. Queue commands shown in the report are preview-only until copied into a separate explicit workflow after the intervention and claims exist.

## Template And Taxonomy Defaults

The onboarding planner keeps a shared category taxonomy so CLI drafts, batch drafts, and the operator wizard start from the same conservative defaults:

- more claim templates, including cardiovascular events, mood/stress, endurance, joint/tendon/skin, eye health, immune/respiratory, fertility/hormones, and biological aging clocks;
- category-specific default claim templates that apply only when no explicit templates or custom claims are supplied;
- category-specific common-form defaults such as softgel/oil for fatty acids, extract/tincture for botanicals, and research/clinical records for peptides;
- name-derived synonym hints from parentheticals, slash-separated terms, and hyphen variants; and
- visible category guardrails for deficiency contexts, product-form distinctions, interaction risk, clinician-sensitive categories, sport/adulteration risk, and peptide/regulatory-concern wording.

These defaults reduce blank setup work but remain draft scaffolding. They do not establish public evidence, dosing, safety, efficacy, or AU/TGA product status.

## Operator Draft Wizard

Authenticated admin/owner operators can use `/operator` to create a private supplement draft without editing seed files and without writing public evidence rows. The wizard previews:

- selected claim templates and custom claim text;
- generated draft claim ids;
- guardrail warnings and blocking review items;
- optional AU/TGA product identity fields and product-status gap assessment;
- collision-aware draft import plan for manual seed copy plus a separately gated operator database-import action preview;
- source-query and queue-command counts; and
- whether the save action is write-gated or read-only.

Saving uses the private `SupplementOnboardingDraft` table and records an operator audit event, including the AU/TGA product-status target and gap count when product identity fields are supplied. It does not create `Intervention`, `Claim`, `Reference`, `Study`, `AustraliaRegulatoryStatus`, source-candidate, or public promotion rows. The existing operator write gates still apply: `APEX_OPERATOR_WRITES_ENABLED=true`, non-production write QA evidence, flow review evidence, and browser-control approval evidence are required.

The wizard preview now includes the same post-draft handoff commands generated by the CLI packet plus the read-only draft import plan from the seed-diff helper. These commands are meant to reduce copy/paste friction after a draft is reviewed: seed-diff review, import-assistant preview, supplement readiness, source queue preview without `--apply`, onboarding status, AU/TGA product-status review, full-text source next action, and local validation. The seed-diff/import-assistant path remains no-write and future-gated for database import. It does not accept candidates, extract studies, mark packets reviewed, promote evidence, write database intervention/claim rows, or fetch full text.

The operator console also lists recent saved supplement drafts for admin/owner operators. That panel shows draft status, claim count, blocker/warning counts, the collision-aware manual seed-copy status, the no-write/future-gated import-plan status, and a separate operator database-import action preview. The preview lists whether import is blocked, review-required, or ready, planned draft row counts, database ID collisions, public-visibility warning, and the required `onboarding:import` permission. Rendering the panel is read-only and does not save, import, queue, accept, extract, review, or promote anything.

An actual saved-draft database import is a separate authenticated browser action. It requires the normal operator write/browser evidence plus `APEX_ONBOARDING_DATABASE_IMPORT_ENABLED=true` and `APEX_ONBOARDING_DATABASE_IMPORT_REVIEWED_AT`. The action requires an import note, creates only draft `Intervention`, unreviewed `Claim`, and Unknown `AustraliaRegulatoryStatus` rows, marks the saved draft `READY_FOR_REVIEW`, and records `supplementOnboarding.databaseImport` audit metadata. It does not mark claims human-reviewed, accept/reject candidates, link references, extract studies, approve connectors, fetch full text, infer AU/TGA product status, or promote public evidence.

The operator console also has a read-only guided onboarding workflow panel. It combines private saved drafts, source/candidate next-action routing, promotion-readiness checks, and global source/full-text gates into one ordered "what next" readout. It surfaces commands such as import-assistant preview, source queue preview, candidate review overview, review-packet preview, promotion readiness, and full-text source gate checks, but it does not add apply/write flags or perform any candidate decision, extraction, review, connector approval, database import, or promotion.

## Local Review Kit

To write the complete local review bundle for a supplement draft in one no-overwrite step:

```bash
npm run onboarding:review-kit -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep
```

The command writes `docs/codex/onboarding/<slug>-review-kit/` with:

- `00-index.md` for boundaries, summary, and next action;
- `01-draft.md` for the generated supplement packet;
- `02-seed-diff.md` for seed-copy review and the draft import plan;
- `03-handoff-commands.md` for copy-safe follow-up commands;
- `04-review-packet-shell.md` for per-claim read-only review-packet commands after reviewed records exist;
- `05-product-status.md` for exact AU/TGA product-status evidence review; and
- `06-fulltext-next.md` for the full-text source gate next step; and
- `07-import-assistant.md` for draft-to-seed/database import planning.

The kit is local-file-write only. It does not edit seed data, create database intervention/claim rows, queue sources, accept or reject candidates, extract studies, mark claim packets reviewed, approve connectors, fetch full text, or promote evidence. If a local kit already exists, the command fails rather than overwriting; use `--force-review-kit` only after reviewing local notes that may be replaced.

For a batch fixture, the same write command creates one local kit per supplement plus a batch-level index:

```bash
npm run onboard:supplement -- --batch-file docs/codex/onboarding/examples/batch-onboarding.json --write-review-kit
```

The batch writer preflights every kit file and `batch-review-kit-index.md` before writing, so stale local notes fail the command before a partial batch is created. The index keeps the same local-file-write boundary and lists generated kit paths, priority order, review items, and the next safest review action.

## Import Assistant

To preview the current manual seed-copy path and the future database-import shape without performing any write:

```bash
npm run onboarding:import-assistant -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep --summary
```

The import assistant reports manual seed-copy status, planned database records, required future gates for a generic database import action, and public-promotion prerequisites. This CLI report remains `future-gated` and `supportedNow=false`; it has no import command and repeats no-auto-write, no-database-write, no-public-evidence-row, no-candidate-decision, no-extraction-write, no-auto-review, and no-auto-promotion flags. Use the authenticated operator saved-draft panel for the separately gated, audited database-import browser action.

## Batch Drafting

For several supplements at once, create a local JSON file shaped as either an array or `{ "supplements": [...] }`:

```json
[
  {
    "name": "Magnesium glycinate",
    "category": "Vitamin/mineral",
    "claimTemplateIds": ["sleep", "safety"],
    "synonyms": ["magnesium"]
  },
  {
    "name": "Example peptide",
    "category": "Peptide/biologic",
    "synonyms": ["research chemical vial"]
  }
]
```

An example batch file is saved at `docs/codex/onboarding/examples/batch-onboarding.json`.

Then run:

```bash
npm run onboard:supplement -- --batch-file docs/codex/onboarding/batch.json
```

Batch output includes a read-only priority queue so multi-supplement drafts can be reviewed in a safer order:

- `safety-regulatory-review`: safety/watchlist or regulatory guardrails need review before seed/data work;
- `product-status-review`: exact AU/TGA product-status gaps need review before product-sensitive records;
- `scope-review`: claim scope, category, or source-packet blockers remain; and
- `ready-for-seed-review`: the packet is ready for a final manual seed/data review before source queueing.

The priority queue explains the action, blocker counts, safety signals, product-status gaps, source queue commands, and rationale for each supplement. It does not combine queueing, candidate acceptance, extraction, review, or promotion.

Batch mode is still read-only. It generates separate supplement packets and combined queue commands, but does not queue sources, accept candidates, extract studies, mark reviews, or promote evidence. Use `--json` for structured output or `--write-draft` to write one local draft per supplement.
Batch plans include progress counts for supplement count, draft claims, source queries, queue commands, blocker-bearing supplements, safety-signal supplements, and product-status targets. The operator quality panel also shows cross-supplement batch progress and a visible priority queue for onboarded supplements, ordered by blockers, safety caveats, pending candidates, warnings, extraction gaps, and promotion-readiness review.

## Seed Diff Review

To turn an onboarding packet into a copy-review seed-data diff without editing files:

```bash
npm run onboarding:seed-diff -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep
```

For a short machine-readable summary:

```bash
npm run onboarding:seed-diff -- --name "Magnesium glycinate" --category "Vitamin/mineral" --template sleep --summary
```

For several supplements:

```bash
npm run onboarding:seed-diff -- --batch-file docs/codex/onboarding/examples/batch-onboarding.json --summary
```

The report compares proposed intervention, claim, and AU/TGA status ids against existing seed data, flags collisions, separates seed-copy blockers from public-promotion prerequisites, and prints:

- proposed add operations for `interventions`, `claims`, and `australiaRegulatoryStatuses` in `src/lib/seed-data.ts`;
- a conservative TypeScript snippet copied from the onboarding packet;
- a draft import plan that separates manual seed copy from future-gated database import;
- blockers, warnings, safety/watchlist counts, product-status gap counts, and review checklist;
- queue commands to run only after reviewed copy and validation; and
- validation commands: `npm run db:validate`, `npm run typecheck`, `npm run test`, and `npm run build`.

The import plan can report manual seed copy as blocked, review-required, or ready for manual seed copy. Database import is explicitly `future-gated`: there is no import command yet, and any future database import action must be separately implemented, authenticated, audited, and reviewed before it can create intervention or claim rows.

This helper is read-only. It does not write `src/lib/seed-data.ts`, write database intervention/claim rows, run validation, queue sources, ingest candidates, mark reviews, promote evidence, or fetch full text.

## Readiness

After the supplement exists in seed or database data, run:

```bash
npm run onboarding:readiness -- --supplement magnesium-glycinate --summary
```

For a database-backed environment:

```bash
npm run onboarding:readiness -- --env-file .env.vercel.preview.local --supplement magnesium-glycinate --summary
```

The readiness report checks intervention presence, claim scopes, specific use-case coverage, AU/TGA status, source jobs, source candidates, source-packet completeness, and human review state. Source-candidate rows include automated source-conviction scoring, ranking, and exact or high-similarity duplicate identity/title clustering when database-backed candidates are available.

## Next Action

To ask the onboarding system what to do next without writing anything:

```bash
npm run onboarding:next -- --summary
```

For a single supplement:

```bash
npm run onboarding:next -- --supplement magnesium-glycinate --summary
```

For database-backed source tracking:

```bash
npm run onboarding:next -- --env-file .env.vercel.preview.local --supplement magnesium-glycinate --summary
```

The report reuses the quality dashboard and returns one recommended read-only command per visible supplement: draft claim scopes, preview source queueing, dry-run ingestion checks, review candidates, build review packets, fill extraction gaps, check promotion readiness, or monitor a ready packet. It also surfaces global gates such as missing database-backed source tracking and the full-text source gate. It does not add `--apply`, accept/reject candidates, extract studies, mark packets reviewed, promote public evidence, or fetch full text.

## Status Command

For a single read-only onboarding status view:

```bash
npm run onboarding:status -- --summary
```

For one supplement:

```bash
npm run onboarding:status -- --supplement magnesium-glycinate --summary
```

For database-backed source tracking and an optional reviewed full-text inventory:

```bash
npm run onboarding:status -- --env-file .env.vercel.preview.local --fulltext-inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.example.json --summary
```

The status report composes the quality dashboard, operator priority queue, next-action routing, per-supplement readiness summaries, full-text source gate, full-text source next-step planner, connector-review draft summary, connector-approval packet summary, an ordered workflow checklist, and the relevant read-only follow-up commands. The workflow checklist marks each stage as `blocked`, `current`, `pending`, or `complete` and includes the next safe command for draft claims, source queueing, ingestion dry runs, candidate review, extraction, packet review, promotion readiness, full-text source gating, connector review, and connector approval packet generation. When `--fulltext-inventory-file` is supplied, the command list also includes the bundled local connector prep kit writer so the review draft, fixture-first plan, approval packet, and index can be generated together. It keeps writes separate: no source queue apply, candidate review, structured extraction, human-review marking, connector implementation approval, promotion, or full-text capture is run by this command.

When `--fulltext-inventory-file` is supplied, the status summary now embeds the full-text readiness gate, local inventory progress report, next-step planner, connector-review draft summary, and connector-approval packet summary in one `fullText` block. This gives the same `blocked` / `hold` / `ready-for-review` connector-review status, `blocked` / `hold` / `ready-for-approval` approval-packet status, and `not-started` / `in-progress` / `premature-approval` / `ready-for-connector-review` inventory progress without running live fetch, approving a connector, or approving implementation. The bundled prep-kit command is local-file-write only and still preserves the approval-false connector boundaries.

## Review Packet Builder

Generate a read-only packet for all claims in a supplement:

```bash
npm run onboarding:review-packet -- --supplement magnesium-glycinate
```

Or focus one claim:

```bash
npm run onboarding:review-packet -- --claim-id magnesium-glycinate-sleep --env-file .env.vercel.preview.local
```

The packet keeps review separate from promotion. It shows curated references and structured extractions, best-first source candidates with source-conviction explanations, rejected/low-conviction candidates as limitations, caveats, citation traceability, proposed public wording constrained to `review-required`, and a promotion diff for claim text, score labels, uncertainty labels, reference links, dashboard-card impact, and required audit metadata.

Each packet also includes a read-only `operatorDecision` summary:

- `ready-for-human-review`: curated references and extraction are complete, no pending candidates remain, and the packet is ready for explicit human review;
- `needs-more-evidence`: source links, extraction, review gates, or pending candidates still need work; and
- `hold-or-reject`: blocked safety/watchlist context or unsupported low-conviction evidence means the packet should be held or rejected until stronger reviewed evidence exists.

This summary is decision support only. It does not accept/reject candidates, mark claim packets reviewed, promote public evidence, or replace the human-owned review action.

Each packet also includes a read-only `candidateReviewAutopilot` block. It picks the next safest candidate-review action from the source-conviction ranking, names a recommended candidate when one exists, explains the source-reputation / triage / limitation rationale, and emits a copy-safe `npm run ingest:sources -- --candidate-curation-draft <dedupe-key>` command when the candidate has a dedupe key. The autopilot can report `review-pending-candidate`, `summarize-limitations`, `ready-no-pending-candidates`, or `blocked-by-safety`. It always repeats `noAutoAccept`, `noAutoReject`, `noAutoExtraction`, and `noAutoPromotion`; it does not change candidate decisions or public evidence.

## Quality Dashboard

For a read-only cross-supplement onboarding status report:

```bash
npm run onboarding:quality -- --summary
```

For a database-backed environment:

```bash
npm run onboarding:quality -- --env-file .env.vercel.preview.local --summary
```

The report shows each supplement's draft/review state, source-job queue state, candidate availability, source-conviction distribution, extraction completeness, review-packet completeness, accepted-packet safety-signal counts, review-diff counts, review-packet decision-support counts, candidate-review autopilot counts, recommended-candidate packet preview commands, promotion readiness, blockers, warnings, and priority-queue rationale. It also includes the full-text source next-step planner so the summary can recommend the safest template, worksheet, progress, premature-approval repair, hold, or connector-review command for the current inventory state. The authenticated operator console shows the same read-only quality snapshot to candidate-review-capable operators; it does not add any public route or write flow.

The quality report also embeds the read-only full-text source gate so future capture readiness is visible during normal onboarding checks. The authenticated operator quality panel mirrors the same gate and now includes the source next-step planner, compact full-text inventory progress, connector-review draft counts, and connector-approval packet counts, while repeating that approval is not granted, implementation approval is false, connector approval is false, and live fetch remains false. To test a user-owned source inventory in the combined report without approving live capture in code, add:

```bash
npm run onboarding:quality -- --fulltext-inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.example.json --summary
```

## Post-Onboarding Monitor

To run only the post-onboarding maintenance monitor:

```bash
npm run onboarding:monitor -- --summary
```

For one supplement:

```bash
npm run onboarding:monitor -- --supplement magnesium-glycinate --summary
```

For database-backed source tracking and an optional reviewed full-text inventory:

```bash
npm run onboarding:monitor -- --env-file .env.vercel.preview.local --fulltext-inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.example.json --summary
```

The quality and status reports also include the same read-only `monitor` block, and the authenticated operator console shows the same post-onboarding monitor. It watches already-visible onboarding signals for maintenance issues:

- stale review evidence based on intervention `lastReviewed` and claim `lastUpdated` dates;
- risk-aware refresh cadence, with routine, watch, and high-attention tiers;
- missing or explicitly Unknown AU/TGA product-status records;
- pending source candidates;
- extraction, reference-link, or unreviewed-claim gaps;
- accepted-packet safety/watchlist caveat signals;
- promotion-ready packets that still require a separate audited promotion-readiness check; and
- global source-tracking or full-text source-gate issues.

Routine reviewed packets start from a 365-day refresh interval. The monitor shortens that interval to 180 days for watch items such as missing/Unknown/unapproved product status, pending candidates, unreviewed claim packets, low-confidence, speculative, insufficient, conflicting, or safety-emerging claims. It shortens to 90 days for high-attention categories such as peptide/biologic or geroprotector watchlist entries, safety/regulatory/avoid/clinician-oversight labels, accepted safety/watchlist signals, or high-severity safety alerts.

The monitor only explains issue severity, rationale, and next read-only command previews. It does not write seed or database rows, accept or reject candidates, extract studies, mark claims reviewed, approve connectors, fetch full text, or promote public evidence.

## Source-Query Planner

Generated onboarding packets now create a claim-specific query plan. Each draft claim gets a prioritized set of explicit search bundles:

- `Core evidence sweep`: review-level PubMed, human-trial PubMed, ClinicalTrials.gov, safety PubMed, and AU/TGA review handoff;
- `Outcome-specific evidence bundle`: targeted PubMed terms for the claim outcome, such as sleep-quality, LDL/ApoB, HbA1c, resistance-training, cognition, or cardiovascular-event endpoints; and
- `Category-specific safety/context bundle`: category-aware PubMed terms for deficiency/upper-limit context, EPA/DHA formulation caveats, standardized-extract quality, strain/fiber specificity, sport/adulteration risk, endocrine context, peptide/regulatory review, or food-matrix/product-quality context.

Executable PubMed and ClinicalTrials.gov commands include both `--intervention-id` and `--claim-id` metadata so candidates stay scoped to the draft claim. Every query carries a bundle label, priority, term, and rationale in the packet. AU/TGA product status remains a separate product-level review workflow, not an inferred source-candidate import.

## Source Conviction

Source conviction is automated decision support. Database-backed readiness reports and generated onboarding packets explain the policy so each new supplement has the scoring frame attached to its workflow. It weights:

- source reputation up to 30 points, with PubMed-indexed biomedical records currently weighted as `high-repute` and ClinicalTrials.gov registry records as `moderate-repute`;
- study design up to 30 points, with systematic reviews/meta-analyses and human trials weighted above observational, case-level, registry-only, preclinical, or unclear records;
- traceability up to 14 points for external identifiers and stable URLs;
- recency up to 8 points;
- abstract availability up to 8 points;
- ingestion triage signals up to 12 points; and
- a title/query relevance penalty up to 12 points when title overlap is weak.

`npm run onboarding:quality -- --summary`, `npm run onboarding:status -- --summary`, and `npm run onboarding:review-packet -- --summary` include the current source-conviction rubric so the weights, label bands, and no-auto-decision guardrails are visible in command output. Candidate assessments also carry a score breakdown for reputation, study design, traceability, recency, abstract availability, triage signal, and relevance penalty.

The score is explained with positive factors, limitations, source-reputation label, and a candidate triage recommendation:

- `review-first`: high-conviction, traceable, claim-relevant candidates that should be checked first for possible accepted-reference matching;
- `review-after-stronger-sources`: moderate candidates that may be useful after stronger records are reviewed;
- `limitations-only`: context or weak support that should usually be summarized as a limitation rather than used as support; and
- `hold-or-reject`: weak, low-relevance, or low-conviction candidates that should not support the packet unless manual review finds strong claim-scoped relevance.

These recommendations now flow into readiness source-conviction summaries, duplicate/source clusters, review packets, review-packet CLI summaries, and the authenticated operator candidate-review queue ordering. Queue rows show the recommendation, source-conviction score, source-reputation label, rationale, curation-draft command, and read-only packet preview commands for candidate packet, reference matches, siblings, and curation status while repeating no-auto-decision boundaries. They are still decision support only: not an automatic evidence grade, not medical advice, not candidate acceptance, and not a substitute for the explicit public promotion gate.

## Safe Queueing

To print queue commands without writing anything:

```bash
npm run onboarding:queue-sources -- --supplement magnesium-glycinate
```

To create queued source-candidate jobs after the intervention and claims exist:

```bash
npm run onboarding:queue-sources -- --env-file .env.vercel.preview.local --supplement magnesium-glycinate --apply
```

This writes queue rows only. It does not run live ingestion, accept/reject candidates, link claims, extract studies, mark claims reviewed, or promote public evidence.

## Evidence Extraction Prefill

After a candidate is accepted against a curated reference, generate a read-only curation draft:

```bash
npm run ingest:sources -- --env-file .env.vercel.preview.local --candidate-curation-draft <dedupe-key>
```

The draft now includes conservative `prefillFields`, metadata-derived `reviewCues`, `uncertaintyNotes`, and `whatWouldChangeScore` text. Prefill values can come from registry/source metadata, opt-in PubMed abstract capture during private source-candidate ingestion, ClinicalTrials.gov registry brief summaries, or derived source-type hints. Each prefill field and review cue carries both provenance confidence (`candidate-metadata`, `derived`, or `manual-required`) and an operator-facing review-confidence label:

- `Strong`: direct candidate metadata or captured abstract/registry-summary text that is useful for first-pass extraction review;
- `Inferred`: derived from metadata or registry signals and requiring source verification before writing;
- `Weak`: broad metadata that may not match the analyzed study field exactly; and
- `Missing`: no usable value is available, so human extraction is required.

Review cues explain traceability, study-design, title/query-overlap, abstract/source-text status, full-text manual status, publication context, registry status, and outcome-review signals when available. They are decision support only. The command template can carry high-traceability metadata forward, including optional `--study-abstract` text when captured, but accepted references, claim links, structured extraction writes, claim packet review, and public promotion still stay explicit and operator-owned. The authenticated operator extraction form surfaces the same field-level suggestions and review-confidence labels next to the extraction inputs, including optional abstract/source-summary, duration, dose, and main-results fields, without auto-submitting or promoting anything.

## Full-Text Source Gate

Before any future full-text connector is implemented, run the source approval gate:

```bash
npm run onboarding:fulltext-sources -- --summary
```

The default report is read-only and intentionally blocks live full-text capture. It lists candidate source classes, missing terms/policy/rate/cache/retention review, private-data or anti-automation risks, and the derived-only local fixture contract. The summary also includes a `reviewQueue` that ranks source classes for human-owned review:

- `start-here`: higher-repute biomedical, registry, regulatory, or government source classes with API/bulk-style access and no login/CAPTCHA/private-data risk;
- `fixture-only`: operator-owned local fixture paths that are useful for parser-shape dry runs but not live capture;
- `review-later`: recognizable but lower-priority source classes that still need source-specific terms and access review; and
- `hold`: publisher pages, login/auth/CAPTCHA paths, or other high-friction automation targets.

Each queue item includes a `/100` source-conviction score, positive factors, limitations, and missing required review fields. Higher weight goes to reputable source classes, API/bulk access, dry-run support, reviewed terms/policy/retention/export fields, and low automation risk. Lower weight goes to unknown reputation, page automation, private-data risk, missing approval fields, login/auth requirements, and anti-automation risk. The score is only source-inventory decision support; it is not evidence quality, medical advice, approval for live fetch, or permission to publish raw text.

To test a user-owned review inventory without editing code, pass a local JSON file:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.example.json --summary
```

To start a user-owned local review inventory, print a template:

```bash
npm run onboarding:fulltext-sources -- --template
```

Or write one to an ignored local file:

```bash
npm run onboarding:fulltext-sources -- --write-template docs/codex/onboarding/fulltext-source-inventory.local.json
```

The generated template includes the review checklist and default source classes, but all approval booleans are `false`, reviewer fields are blank, and live fetch support is disabled. The write command refuses to overwrite an existing file unless `--force` is supplied. Keep `*.local.json` inventories user-owned; use the committed example only as a shape reference.

For the lowest-friction start, write the local review kit:

```bash
npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding
```

The kit writes both `fulltext-source-inventory.local.json` and the top-priority source worksheet, such as `fulltext-source-review-pmc-open-access.md`. It preflights all target paths before writing, refuses overwrite unless `--force` is supplied, keeps every approval false, disables live fetch, and does not approve a source, connector, raw storage, public export, source candidate, extraction, claim review, or promotion.

To write the approval-false inventory starter plus one worksheet for every ranked source class in the review queue:

```bash
npm run onboarding:fulltext-sources -- --write-review-kit docs/codex/onboarding --all-sources
```

The all-source kit adds `fulltext-source-review-kit-index.md` and one worksheet per queued source class, ordered by source-review priority. It is still local-file-write only: it does not approve a source or connector, enable live fetch, store raw full text, accept candidates, write extraction rows, mark claim reviews, or promote evidence.

To let the source gate pick the safest next local step:

```bash
npm run onboarding:fulltext-sources -- --next --summary
```

After a local inventory exists, include it:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --next --summary
```

The next-step planner composes the all-source review kit, focused worksheet, progress, and connector-review helpers into one recommended command list. For a blank inventory, it now recommends the all-source review kit first, then the focused single-source kit if you want a narrower local worksheet. It can route to `create-inventory-template`, `continue-source-review`, `fix-premature-approval`, `hold-connector-automation`, or `open-connector-review`. It still sets `noAutoApproval`, `noConnectorApproval`, and `noLiveFetch`; local file-write commands only create review artifacts and do not approve a source, connector, live fetch, storage, public export, candidate, extraction, claim review, or promotion.

To avoid a blank-page review, generate a worksheet for the top-ranked source class:

```bash
npm run onboarding:fulltext-sources -- --worksheet
```

Or focus a specific source:

```bash
npm run onboarding:fulltext-sources -- --worksheet --source-id operator-local-source-packet
```

The worksheet is Markdown and read-only. It includes the selected source tier, source-conviction score, positive factors, limitations, missing fields, a field-by-field review checklist, and a safe inventory starter JSON block. The starter preserves source identity/details but keeps approvals false, clears reviewer fields, disables live fetch, and must be copied into a user-owned inventory file before any rerun. Use `--write-worksheet <path>` to save the worksheet locally; it refuses to overwrite an existing file unless `--force` is supplied.

After editing a local inventory, inspect progress:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --progress --summary
```

The progress report compares each source entry against the safe starter, counts completed required review fields, lists missing fields, shows changed checklist fields, and flags premature approvals such as live-fetch approval before terms/API/robots/retention review. It can report `not-started`, `in-progress`, `premature-approval`, or `ready-for-connector-review`, but it still does not fetch full text or approve a connector. A `ready-for-connector-review` source only means a separate explicit connector implementation review may begin.

For the lowest-friction connector prep step, write the bundled local kit:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --write-connector-prep-kit docs/codex/onboarding
```

The connector prep kit writes `fulltext-connector-prep-kit-index.md`, `fulltext-connector-review.md`, `fulltext-connector-implementation-plan.md`, `fulltext-connector-approval-packet.md`, and blank local fixture starters for any fixture-design-ready source in one preflighted local-file step. Fixture starters live under `fulltext-fixtures/*.local.json`, remain blocked until reviewed local values are filled, and carry only placeholder excerpt text. The kit still grants no approval: `approvalGranted=false`, `noConnectorApproval=true`, `noImplementationApproval=true`, `noLiveFetch=true`, and `noNetworkFetch=true`. The generated files do not approve a source, connector, implementation, raw-text storage, public raw-text export, candidate decision, extraction write, claim review, or promotion.

When an inventory reaches `open-connector-review`, the normal next-action, status, and packet summaries now surface the generated fixture-starter follow-ups:

```bash
npm run onboarding:fulltext-fixture -- --fixture-dir docs/codex/onboarding/fulltext-fixtures --progress --summary
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/<connector-key>.local.json --summary
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/<connector-key>.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary
```

These commands are read-only previews. The progress command classifies local fixture files as blank, filled, extraction-draft-ready, or blocked without live fetch. The single-file validator checks a locally filled fixture without echoing raw excerpts; the extraction draft maps reviewed local derived fields to command flags without validating database state, deciding candidates, writing extraction rows, marking claim reviews, or promoting evidence.

To prepare that separate review packet without approving a connector:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-review
```

For a compact machine-readable view:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-review --summary
```

The connector-review draft lists each source's connector key, `blocked` / `hold` / `ready-for-review` status, policy fields, blockers, implementation checklist, and validation commands. It repeats `noConnectorApproval`, `noAutoApproval`, and `noLiveFetch`; the draft is only a planning packet for a future explicit connector implementation review. Use `--write-connector-review <path>` to save the Markdown draft locally with no-overwrite behavior.

After a source is genuinely `ready-for-review`, generate a fixture-first implementation plan:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-plan
```

For a compact machine-readable view:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-plan --summary
```

The connector implementation plan is still planning-only. It lists blocked versus fixture-design-ready sources, planned local fixture/parser files, fixture-first phases, guardrails, and validation commands. It repeats `noAutoApproval`, `noConnectorApproval`, `noLiveFetch`, and `noNetworkFetch`, and it does not create connector code, make network requests, approve live fetch, store raw text, expose public raw text, accept candidates, extract studies, mark claim reviews, or promote evidence. Use `--write-connector-plan <path>` to save the Markdown plan locally with no-overwrite behavior.

After connector review and fixture-first planning are ready, generate the explicit approval packet:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-approval-packet
```

For a compact machine-readable view:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/fulltext-source-inventory.local.json --connector-approval-packet --summary
```

The approval packet is still read-only and grants no approval. It combines connector-review status, fixture-first implementation-plan status, dry-run support, terms/access-policy evidence, rate/cache/retention controls, derived-only public export boundaries, planned files, guardrails, validation commands, and an operator decision template. It reports `blocked`, `hold`, or `ready-for-approval`, while repeating `approvalGranted=false`, `noConnectorApproval`, `noImplementationApproval`, `noLiveFetch`, and `noNetworkFetch`. Use `--write-connector-approval-packet <path>` to save the Markdown packet locally with no-overwrite behavior.

To validate the local fixture shape without live fetch:

```bash
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/examples/fulltext-local-fixture.example.json --summary
```

To avoid hand-building JSON, print or write a starter fixture:

```bash
npm run onboarding:fulltext-fixture -- --template --source-id pmc-open-access
npm run onboarding:fulltext-fixture -- --write-template docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --source-id pmc-open-access
```

The template is parseable but intentionally not ready: derived target values are blank and all target confidence labels are `Missing`, so the validator blocks it until reviewed local values are added. The fixture validator is local and read-only. It parses an operator-owned fixture with `sourceId`, `sourceUrl`, `capturedAt`, `title`, a short `textExcerpt`, derived extraction targets, and a reviewer note. Reports include source metadata, excerpt length, derived target fields, warnings, blockers, and boundary flags, but do not echo the raw excerpt. Oversized excerpts are blocked so fixture files do not become raw full-text storage. The command does not fetch full text, approve sources or connectors, write extraction rows, accept candidates, mark claim reviews, or promote evidence.

After a fixture has reviewed local derived targets, draft the existing source-candidate extraction command without writing anything:

```bash
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/fulltext-fixtures/pmc-open-access.local.json --extraction-draft --candidate-key <accepted-candidate-dedupe-key> --study-source-type randomized-controlled-trial --summary
```

The extraction draft maps reviewed fixture fields onto the existing `npm run ingest:sources -- --extract-candidate-study` flags and reports missing required write fields before any operator action. Required command fields are sample size, population, intervention name, at least one outcome, adverse events, funding/conflicts, and risk of bias. Optional fixture fields can fill abstract/source summary, dose, duration, and main results. Comparator remains review-only context because it is not currently a Study write flag. The draft repeats `noExtractionWrite`, `noDbValidation`, `noCandidateDecision`, `noPromotion`, `noLiveFetch`, and `noNetworkFetch`; the real ingest command still enforces accepted-candidate, reference-match, claim-link, and operator write gates.

To rehearse the green path without creating a real source approval, use the synthetic reviewed fixture:

```bash
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --progress --summary
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --connector-review --summary
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --connector-plan --summary
npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --connector-approval-packet --summary
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/examples/fulltext-local-fixture.example.json --summary
npm run onboarding:fulltext-fixture -- --fixture-file docs/codex/onboarding/examples/fulltext-local-fixture.example.json --extraction-draft --summary
npm run onboarding:status -- --fulltext-inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --summary
```

The fixture uses `example.test` URLs and synthetic wording. It is only for parser, status, connector-review, connector-plan, and approval-packet happy-path rehearsal; it does not approve any real source, connector, implementation, live fetch, raw-text storage, or public export.

To exercise all built-in source-gate states in one read-only check:

```bash
npm run onboarding:fulltext-sources -- --fixture-matrix --summary
```

The fixture matrix covers blocked default, in-progress review, premature approval, and connector-review-ready scenarios with synthetic entries only. It is a regression rehearsal for the gate logic; it does not load a user inventory, fetch full text, approve a source, approve a connector, store raw text, or publish anything.

The gate does not fetch full text, store raw article text, approve source terms, queue source jobs, extract studies, or publish evidence. A live connector remains a separate explicit implementation only after a source entry has reviewed terms, access method, robots/API policy, rate limit, cache TTL, raw retention policy, derived-only export policy, and explicit storage/live-fetch/public-export approvals.

## Boundaries

- The draft helper does not mutate seed data, queue source jobs, accept/reject candidates, link claims, extract studies, mark claim packets reviewed, or publish public evidence.
- The seed-diff helper prints copy-review snippets only; it does not mutate `src/lib/seed-data.ts` or the database.
- The operator draft wizard saves only private onboarding draft records until a later explicit reviewed promotion/import workflow is used.
- The queue helper creates queue rows only when `--apply` is supplied; live ingestion and review remain separate commands.
- The full-text source gate is read-only and does not approve or perform live full-text capture.
- AU/TGA product status remains unknown until product-level ARTG/AUST evidence is reviewed.
- No individualized medical advice, dosing guidance, sourcing, procurement, compounding, reconstitution, injection, cycling, or self-administration guidance is generated.
- Peptide/watchlist language produces conservative guardrail warnings and still requires explicit regulatory/safety review before public use.

## After The Draft

1. Review category, synonyms, forms, and claim scopes.
2. Add reviewed intervention and claims to seed data or an operator-only database workflow.
3. Use `npm run onboarding:seed-diff` to inspect copy-review seed snippets and id collisions before editing seed data.
4. Run seed/database validation.
5. Queue the generated claim-scoped source searches.
6. Review source candidates, link accepted references, extract structured study metadata, and only then mark claim packets human-reviewed.

## Historical Roadmap

Completed onboarding automation roadmap history moved to `docs/codex/archive/reference/2026-06-19-supplement-onboarding-automation-roadmap.md`. Keep this reference focused on current command behavior, boundaries, and operator workflow contracts.
