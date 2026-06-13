# Full-Text Connector Approval Decision

Date: 2026-06-13

Decision: Approved for fixture-only implementation review.

Source inventory evidence:
- Command: `npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --progress --summary`
- Result: `ready-for-connector-review`, `liveCaptureReady=true`, `noLiveFetch=true`, `readOnly=true`.

Connector approval packet evidence:
- Command: `npm run onboarding:fulltext-sources -- --inventory-file docs/codex/onboarding/examples/fulltext-source-inventory.reviewed-fixture.example.json --connector-approval-packet --summary`
- Result: one source was `ready-for-approval` with all eight checklist items complete.

Approved scope:
- Connector key: `synthetic-reviewed-open-access-source`
- Source: Synthetic reviewed open-access source
- Scope: fixture-only parser and derived-field tests.
- Public export: derived fields, citations, and traceability only; no raw full text.

Boundaries retained:
- No live network fetch approval.
- No production connector implementation approval.
- No source-candidate decision.
- No extraction write.
- No claim review or public promotion.

Operator note:
- User confirmed: "ok done and I explicitly approve a separate connector".
