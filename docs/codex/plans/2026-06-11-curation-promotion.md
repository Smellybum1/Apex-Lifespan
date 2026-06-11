# Curation Promotion Plan

Date: 2026-06-11

## Scope

Roadmap step 7: implement human-reviewed curation promotion from source candidate to public evidence packet.

## Constraints

- Promotion must be explicit and human-reviewed.
- No candidate becomes public evidence automatically from ingestion.
- A promotion path must require accepted candidate decision, claim link, structured extraction, citation traceability, and human review.
- First slice is dry-run/read-only only.

## Implementation Order

1. Add a read-only promotion assessment function.
2. Add a local CLI dry run for a candidate dedupe key.
3. Validate dry run against accepted `PMID 42141930` before any public promotion.
4. Add audited promotion write only after readiness checks and operator auth are configured.
5. Wire promotion controls into the operator surface only after non-production manual QA.

## Validation

- Promotion assessment unit tests.
- Source-packet tests.
- Dry-run CLI against accepted `PMID 42141930`.
- Public boundary tests before any route/control is exposed.
