# AGENTS.md

## Codex Rules
- Hobby-project mode: read only what is relevant, make the useful change, and keep moving.
- Do not create process artifacts, handoff history, roadmap micro-goals, or workflow contracts unless they clearly save time right now.
- Ordinary startup scope: read only `AGENTS.md` and `docs/codex/project.md`.
- Conditional docs: read `docs/codex/handoff.md` only when resuming; read `docs/codex/roadmap.md` only for roadmap, prioritization, or next-work planning.
- Current startup docs win: this file and `docs/codex/project.md` override older handoffs, archive docs, `.ai/delegation/`, legacy checklist/runbook/workflow docs, and generated logs. Conditional docs win only for their explicit task.
- Avoid `docs/codex/archive/`, `docs/codex/plans/archive/`, `docs/codex/reference/`, generated `output/`, `.ai/delegation/`, and command catalogs unless the task specifically needs them.
- Inspect existing patterns before editing. Do not invent commands, architecture, or facts.
- Routine local code, docs, tests, read-only UI, and dry-run tooling should proceed autonomously.
- Ask first only before production deploy, DB/secret/destructive actions, or medical/regulatory boundary changes.
- Local evidence-map work may use audited `AI reviewed` decisions when citation traceability, uncertainty labels, AU/TGA caveats, product-level boundaries, and no-medical-advice/no-peptide-operational-guidance rules are preserved. Use `Human reviewed` only after explicit human confirmation.
- The active npm command surface is intentionally tiny. Do not resurrect readiness, queue, promotion, launch, or review-gate scripts unless the user explicitly asks.
- If an older doc or script mentions an `npm run` alias missing from `package.json`, treat that alias as legacy; inspect the script and use `npx tsx <script>` only when the current task truly needs it.
- If a task is only readiness, queue, promotion, review packets, launch rehearsal, or roadmap bookkeeping, stop and pick product-facing roadmap work instead.
- Delete process that slows the project down.

## Lead And Subagent Policy
- Expected lead: user-selected `gpt-5.6-sol` with `ultra` reasoning (`AGENTS.md` cannot enforce this). The lead owns planning, architecture, ambiguous/high-risk/domain-boundary decisions, critical-path work, integration, review, and verification.
- On substantial tasks, first identify independent work and promptly spawn `gpt-5.6-luna`/`max` subagents in parallel; prefer several narrow agents, use available slots and later waves, and keep the lead moving on the critical path. Skip tiny, invented, duplicate, tightly coupled, blocking, overlapping, or integration-sensitive delegations.
- Delegate bounded exploration/research, disjoint implementation, tests, settled mechanical refactors, docs, and independent reviews/checks. Give each agent a concrete task, output, and write scope; never overlap concurrent edits; tell agents they are not alone and must preserve existing changes.
- Subagents inherit every Apex/user guardrail and gain no extra authority, including for Git, cleanup, deploys, DB/migrations, secrets, medical/regulatory boundaries, citation traceability, or review labels. The lead validates every result; if delegation is unavailable, continue and disclose briefly.

## Project Risks
- Risk areas: medical claim accuracy, citation traceability, peptide/regulatory boundaries, dependency advisories
