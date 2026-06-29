# Desloppify Backlog

Generated from a no-fix scan on 2026-06-29. This is a practical cleanup backlog, not a new process gate. Pick one item, fix it, run the smallest useful validation, then show this list again so the next cleanup can be selected.

## Completed

- 2026-06-29: `C1 + M4` completed. Local ingestion routes now share a central guard, POST-style writes require the dashboard write header, and browser-origin/fetch-metadata checks reject cross-site local mutations.
- 2026-06-29: `M5` completed. Source-candidate metadata keys, versions, parsers, and serializers now live in one shared module with focused tests.
- 2026-06-29: Medium cleanup pass applied across `M1`-`M12`. The safe parts are complete: discovery/deepening policy is centralized, Human-reviewed scripts now require explicit confirmation, legacy workflow scripts are marked as non-ordinary, the operator sidecar token is no longer persisted, a fast TS-only check exists, local UI/server/CLI monoliths each had a small behavior-preserving extraction, and the dirty tree was triaged without staging or cleaning.
- 2026-06-29: Follow-up cleanup `P1 + P3 + M1/M3/M11 continuation` completed. Local dashboard panels now show compact next-action strips, bulk/local mutation confirmations are inline instead of browser dialogs, local-ingestion UI helpers are split out, and CLI parser smoke tests are in their own focused file.

## Critical Issues

### C1. Done - Local ingestion mutation routes need a stronger browser write guard

- Where: `src/lib/data/local-ingestion-route-guard.ts`, `src/lib/local-ingestion-security.ts`, `src/components/evidence-dashboard.tsx`, and the `src/app/api/local-ingestion/*/route.ts` routes.
- Why it matters: `isLocalIngestionRequest` blocks Vercel and checks localhost-style request hosts, but it does not verify `Origin`, `Sec-Fetch-Site`, a dashboard-issued local nonce, or a same-origin write token. A malicious web page may be able to trigger localhost POSTs that queue ingestion, process candidates, or mutate the local database even if it cannot read the response.
- Recommend changing: centralize the local route guard, require same-origin/fetch-metadata checks for mutating requests, and add a simple local-only CSRF nonce from the dashboard for POST routes. Keep GET status reads local-host guarded. Add route tests for rejected cross-site POSTs.
- Status: done.

## Medium Cleanup Items

### M1. Reduced - The main dashboard component is doing too much

- Where: `src/components/evidence-dashboard.tsx` is still large, but local-ingestion UI response contracts, tab constants, next-action helpers, and inline confirmation UI now live under `src/components/local-ingestion/`.
- Why it matters: public evidence map UI, local ingestion controls, candidate review, accepted processing, benefit discovery, identity resolution, operator sidecar UI, evidence cards, and source previews all live in one client component. That makes ordinary changes expensive to review and increases the risk that local mutating tools accidentally affect public read-only surfaces.
- Recommend changing: split local-only panels into `src/components/local-ingestion/` and keep `EvidenceDashboard` focused on routing tabs and public evidence display. Start with a behavior-preserving extraction of the local ingestion/candidate review panels.
- Status: continued. Local-ingestion types, next-action readouts, and inline confirmation UI are split out. Full panel extraction should be a separate behavior-preserving chunk if this file becomes active again.

### M2. Reduced - The local ingestion controller is a new monolith

- Where: `src/lib/data/local-ingestion-control.ts` is still large, but batch limits and threshold normalization now live in `src/lib/data/local-ingestion-limits.ts`.
- Why it matters: status reads, candidate review, accepted-candidate processing, benefit discovery, identity resolution, metadata parsing, route guards, and UI readout mapping are bundled together. This will get painful as the local database grows and new discovery behavior is added.
- Recommend changing: split by responsibility into modules such as `status`, `candidate-review`, `accepted-processing`, `benefit-discovery`, `identity-resolution`, `metadata`, and `route-guard`, while preserving existing route imports or adding a small facade.
- Status: first safe extraction done. Further splits should happen one concern at a time when those flows are next touched.

### M3. Reduced - Source-candidate CLI command and tests are oversized

- Where: `src/lib/data/source-candidate-job-command.ts` and `src/lib/data/source-candidate-job-command.test.ts` are still large, but CLI usage text now lives in `src/lib/data/source-candidate-job-command-usage.ts`, usage tests live in `src/lib/data/source-candidate-job-command-usage.test.ts`, and parser smoke tests live in `src/lib/data/source-candidate-job-command-parser.test.ts`.
- Why it matters: argument parsing, command routing, database actions, formatting, review packets, identity views, and job summaries share one giant module. Tests mirror that sprawl, making small changes slow and hard to reason about.
- Recommend changing: split parser, runner, and formatters. Split tests by parser, ingestion runner, candidate review output, identity output, and curation output. Preserve public CLI text unless intentionally changing it.
- Status: continued. Usage and parser smoke tests are split out. Deeper parser/runner/formatter decomposition remains a future maintainability task, best done when the CLI is next active.

### M4. Done - Local ingestion API route boilerplate is duplicated

- Where: each `src/app/api/local-ingestion/*/route.ts` repeats `isLocalIngestionRequest` plus a local forbidden response. Several POST routes parse JSON and handle errors differently.
- Why it matters: duplicate guard/error code makes it easy for the next route to forget a check or return inconsistent errors. It also makes C1 harder to fix consistently.
- Recommend changing: create one tiny route helper such as `withLocalIngestionGuard(request, handler)` or `localIngestionForbiddenResponse`, then use it across all local ingestion routes.
- Status: done.

### M5. Done - Local candidate metadata is becoming an implicit schema

- Where: `src/lib/source-candidate-metadata.ts`, `src/lib/data/local-ingestion-control.ts`, `src/lib/source-candidates.ts`, and `src/lib/data/source-candidate-jobs.ts`.
- Why it matters: these blobs are now real local workflow state, but the schema is spread across helper functions and string paths. Version drift or missing fields can silently produce wrong queue counts, claim-building decisions, or identity-resolution states.
- Recommend changing: centralize metadata types and parse/serialize helpers in one module with version constants and focused tests. Avoid adding a dependency unless it clearly saves code.
- Status: done.

### M6. Done - Discovery/deepening policy is scattered and hard to tune

- Where: `src/lib/source-discovery-policy.ts`, `src/lib/data/source-candidate-jobs.ts`, and `src/components/evidence-dashboard.tsx`.
- Why it matters: broad supplement searches, synonym searches, benefit-area searches, PubMed page caps, useful-candidate thresholds, and classifier signals live in different modules. This works now, but it will be hard to explain why ingestion stopped or why noisy searches continued.
- Recommend changing: create a compact `source-discovery-policy` module for constants and decision helpers, then surface the stop reason and useful-candidate ratio in the local dashboard.
- Status: done. PubMed deepening now uses the shared policy helpers and dashboard activity includes page range, useful-looking candidate count, ratio, cap/total, next-page state, and stop reason.

### M7. Done - Human-reviewed write paths need clearer hard-stop boundaries

- Where: `scripts/review-claim-packet.ts:67`, `scripts/batch-review-expansion-claims.ts:9`, `scripts/batch-review-expansion-claims.ts:84`, `src/lib/operator/claim-packet-review.ts:25`, `src/lib/operator/source-candidate-actions.ts:153`, `src/lib/data/source-candidates.ts:1238`.
- Why it matters: the project rules say `Human reviewed` must only be used after explicit human confirmation. The operator paths do require permissions/notes, but old batch and review scripts remain easy to discover and can mark many records as human-reviewed if used casually.
- Recommend changing: keep legitimate operator review tools, but make batch scripts visibly legacy or require an explicit `--confirm-human-reviewed` style flag with a clear note. Do not add broad process gates.
- Status: done for the easy-to-run scripts. `scripts/review-claim-packet.ts` and `scripts/batch-review-expansion-claims.ts` now require `--confirm-human-reviewed` before writing Human-reviewed decisions.

### M8. Done - Typecheck is coupled to Prisma generate and Next typegen

- Where: `package.json` `typecheck` runs `tsx scripts/generate-prisma-client.ts && next typegen && tsc --noEmit`.
- Why it matters: routine TypeScript validation can be slower and brittle on Windows when a running dev server holds Prisma files. The full check is useful, but it is overkill for many UI-only cleanups.
- Recommend changing: keep `npm run typecheck` as the full check, and consider adding a clearly named fast local check only if it saves repeated time, such as `typecheck:tsc`.
- Status: done. `npm run typecheck` remains the full check and `npm run typecheck:tsc` is available for fast TS-only validation.

### M9. Done - Legacy workflow scripts and docs are still discoverable

- Where: examples include `scripts/promotion-readiness-report.ts`, `scripts/launch-readiness-report.ts`, `scripts/operator-readiness-report.ts`, `scripts/record-launch-evidence.ts`, `scripts/scheduled-source-ingestion.ts`, and docs such as `docs/codex/fully-live-launch-checklist.md` and `docs/codex/operations-runbook.md`.
- Why it matters: package scripts are now small, and active docs warn against resurrecting old gates, but the old files still look runnable to agents. This can pull the project back into process work.
- Recommend changing: do not delete blindly. Add a small legacy banner to old scripts or move clearly retired scripts under a legacy folder once imports are checked.
- Status: done for the obvious script entry points. Legacy/readiness/promotion/launch/scheduled-ingestion scripts now start with a short note that they are not ordinary local product-work commands.

### M10. Done - Operator sidecar token is stored in browser localStorage

- Where: `src/components/evidence-dashboard.tsx:4020`, `src/components/evidence-dashboard.tsx:4024`, `src/components/evidence-dashboard.tsx:4086`, `src/components/evidence-dashboard.tsx:4232`.
- Why it matters: localStorage is convenient but persistent. Any future XSS or overbroad public UI exposure could leak the local sidecar token. The code limits the sidecar URL to localhost, but the token still persists longer than necessary.
- Recommend changing: prefer session-only storage or an in-memory token field, and rename the button copy if it only sends a read-only packet. Keep the sidecar localhost restriction.
- Status: done. The sidecar token is kept in component state only, the URL remains localhost-restricted, and the action copy is now "Send packet".

### M11. Reduced - Huge tests create high context cost

- Where: `src/lib/data/source-candidate-job-command.test.ts`, `src/lib/data/source-candidate-jobs.test.ts`, and related source-candidate tests.
- Why it matters: these tests are valuable, but their size makes targeted review and selective updates expensive. Exact long output assertions can also make small format changes noisy.
- Recommend changing: split by behavior area and replace repeated long strings with compact helper assertions where possible.
- Status: continued. CLI usage assertions and parser smoke tests now live in focused files. More test splitting should happen only alongside nearby feature work.

### M12. Triaged - Current dirty/untracked implementation state is easy to lose or confuse

- Where: `src/app/api/local-ingestion/`, `src/lib/data/local-ingestion-control.ts`, and `Stop Apex Lifespan Server.cmd` are untracked; many tracked docs/code files are dirty.
- Why it matters: the local ingestion work is functional, but a large untracked/dirty surface makes future cleanup harder and raises the chance that useful files are missed in a handoff or commit.
- Recommend changing: once the user is happy with the ingestion behavior, isolate the task-owned files and commit or otherwise preserve that slice. Do not stage or clean unrelated files without explicit instruction.
- Status: triaged only. No files were staged, committed, cleaned, or deleted. The untracked local ingestion routes/helpers, `DESLOPPIFY.md`, and `Stop Apex Lifespan Server.cmd` still need explicit preservation when the user is ready.

## Nice-To-Have Polish

### P1. Done - Local dashboard could use a compact next-action strip

- Where: `src/components/evidence-dashboard.tsx` local ingestion, candidate review, accepted processor, benefit discovery, and identity resolver panels.
- Why it matters: the panels work, but the user flow now has many counters, logs, buttons, and tabs. A single "next best action" strip would make local runs easier to steer.
- Recommend changing: add a compact readout such as "Run ingestion", "Review likely useful", "Process accepted", "Resolve identities", or "Build claims" based on current counts.
- Status: done. Each local panel now shows a compact next-action strip from `src/components/local-ingestion/next-action.tsx`.

### P2. Done - Show why PubMed deepening stopped

- Where: `src/lib/data/source-candidate-jobs.ts:808`, `src/lib/data/source-candidate-jobs.ts:822`, `src/lib/data/source-candidate-jobs.ts:831`; dashboard activity rows in `src/components/evidence-dashboard.tsx`.
- Why it matters: the system now decides whether to keep paging beyond the first 20 results. Showing the stop reason would make ingestion behavior feel less mysterious.
- Recommend changing: store/display the deepening reason, page range, useful count, and useful ratio in recent activity.
- Status: done as part of `M6`.

### P3. Done - Confirmation dialogs are functional but clunky

- Where: `src/components/evidence-dashboard.tsx:1654`, `src/components/evidence-dashboard.tsx:2166`, `src/components/evidence-dashboard.tsx:2214`, `src/components/evidence-dashboard.tsx:2451`.
- Why it matters: browser confirms are quick but interruptive and hard to scan, especially for bulk actions.
- Recommend changing: replace with small inline confirmation rows or modal components only where bulk mutation risk warrants it.
- Status: done. Candidate bulk actions, benefit cluster actions, auto-build, and identity actions now use `InlineConfirmation`.

### P4. Done - The operator mode copy is a little confusing

- Where: `src/components/evidence-dashboard.tsx:4173` to `src/components/evidence-dashboard.tsx:4181`.
- Why it matters: the button says "Approve and send" while nearby copy says the packet is read-only and decisions stay human-owned. That wording can make the action sound more powerful than it is.
- Recommend changing: rename to "Send packet" or "Send to local sidecar" if no approval is actually performed.
- Status: done as part of `M10`.

### P5. Stop-server helper needs a decision

- Where: `Stop Apex Lifespan Server.cmd` is untracked at repo root.
- Why it matters: it is useful for local Windows workflow, but untracked root helpers can become invisible or confusing.
- Recommend changing: either commit it as an intentional local helper, move it under `scripts/`, or document that it is personal/untracked.
- Safe to fix now: safe only after deciding whether it belongs in the repo.

### P6. Keep startup docs short

- Where: `AGENTS.md`, `docs/codex/project.md`, `docs/codex/workflow.md`, and `docs/codex/cursor-composer.md`.
- Why it matters: recent cleanup helped. Future "helpful" docs could accidentally re-add the friction that slowed the project.
- Recommend changing: keep ordinary startup to `AGENTS.md` plus `docs/codex/project.md`; move detailed guidance to task-triggered docs only.
- Safe to fix now: no action needed unless these files grow again.

## Suggested Order

1. P5: decide whether `Stop Apex Lifespan Server.cmd` belongs in the repo root, under `scripts/`, or stays personal.
2. M1/M2 continuation: split one full local ingestion panel or server concern at a time only when that area is active again.
3. M3/M11 continuation: split runner/formatter tests when the CLI is next touched.
4. P6: keep startup docs short if they start growing again.
5. M12 preservation: verify the local-ingestion/product-roadmap commit stays isolated from unrelated dirty files.
