# Onboarding Database Import Plan

## Goal

Reduce supplement onboarding copy/paste friction by adding an explicit, audited operator action that imports a saved private onboarding draft into database rows.

## Scope

- Add a separate `onboarding:import` permission and browser write control.
- Require the existing operator write gate plus dedicated onboarding import env evidence before any import can run.
- Import only draft intervention, unreviewed draft claims, and an Unknown AU/TGA regulatory placeholder.
- Keep claim review, source-candidate decisions, study extraction, connector approval, full-text fetch, and public evidence promotion separate.
- Surface import readiness and blockers in the operator saved-draft panel.

## Safety Boundaries

- Do not auto-promote source candidates or public evidence.
- Do not mark imported claims human-reviewed.
- Do not infer AU/TGA product status from generic ingredient evidence.
- Do not expose unauthenticated write paths.
- Preserve existing read-only seed-diff/import-assistant behavior unless a separate operator import action is explicitly invoked.

## Validation

- Focused operator authorization, browser-control/action, draft-import, and operator-page tests.
- `npm run typecheck`
- Broader validation if focused checks uncover shared behavior.
