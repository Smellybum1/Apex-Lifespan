# Composer

Composer is optional and inactive by default. Use it only when a CPU-generated task contract is
clearer and cheaper than direct Codex editing.

Do not track Codex/Composer token ratios. Do not run recurring delegation monitors. Keep review
artifacts only for real Composer packets or unclear delegation quality.

## CPU-First Packet

Before Composer runs, Codex or a local script must freeze:

- candidate file map and allowed paths
- expected changed files
- exact checks
- acceptance criteria
- stop conditions
- any supplied rows, fields, copy, fixture values, or docs facts

Composer treats `task.json` as the complete source of truth. It must not discover scope, redesign,
make architecture decisions, infer product meaning, research sources, or change protected
boundaries.

## Good Composer Packets

Prefer larger frozen mechanical packets when semantics are already decided:

- `dashboard-ui-plumbing-batch`
- `seed-data-mechanical-batch`
- `docs-status-cleanup-batch`
- `routine-cross-surface-batch`
- focused test or fixture updates
- validator/report plumbing

Keep Codex on architecture, public contracts, scoring/methodology, source-rights/trust decisions,
dependency/security/migration choices, external writes, deploys, pushes/PRs, and final review.

## Minimal Composer Report

Composer should report only:

- `changed_files`
- `checks_run`
- `assumptions`
- `codex_attention_needed: true/false`

No governance packets, essays, token accounting, or redundant risk reports unless Codex asks.

## Exception Review

Codex starts from compact artifacts and spot-checks when:

- allowed paths, changed files, checks, and self-review are clean
- no protected boundary is involved
- no signal is missing or unclear

Codex does full diff review when a review gate says `full-diff`, checks fail, changed files differ
from the contract, Composer asks for attention, protected boundaries are involved, or signals are
missing.

## Optional Direct Commands

Composer commands are intentionally not exposed in `package.json`. Run them directly only when
delegation is actually worth it:

```powershell
node scripts/check-composer-integration.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/composer/preflight.ps1
node scripts/composer/create-task.cjs --list-templates
node scripts/composer/create-task.cjs <task-id> --template dashboard-ui-plumbing-batch --objective "..." --allowed "..." --check "..." --accept "..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/composer/invoke-composer-worker.ps1 -TaskJson <task.json>
node scripts/composer/review-run.cjs <run-dir>
```

Runtime artifacts under `.ai/delegation/` are temporary evidence for a patch, not project memory.
