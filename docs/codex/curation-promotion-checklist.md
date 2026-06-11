# Curation Promotion Checklist

Last updated: 2026-06-11

Use this checklist before any accepted source candidate becomes a public evidence packet. It is a human review checklist, not an automation path.

## Scope

- Applies to accepted source candidates, including `PMID 42141930`.
- Keeps claim linking, structured extraction, and public promotion explicit.
- Does not allow automatic promotion from source-candidate ingestion.

## Preconditions

- Public routes are read-only.
- Operator auth is configured in non-production.
- Operator writes have passed non-production QA.
- Candidate has a human review note and `reviewStatus="Human reviewed"`.
- Candidate has a matching accepted curated reference.

## Review Steps

1. Inspect candidate state:

```bash
npm run ingest:sources -- --candidate-curation-status <dedupe-key>
```

2. Inspect the curation draft:

```bash
npm run ingest:sources -- --candidate-curation-draft <dedupe-key>
```

3. Confirm the claim link is correct for the candidate claim, intervention, population, outcome, and reference.

4. Confirm structured study extraction is complete and human-entered for:

- sample size
- population
- intervention
- outcomes
- adverse events
- funding/conflicts
- risk of bias

5. Confirm citation traceability:

- accepted reference id is present
- reference URL is present
- reference title is present
- claim link exists
- at least one structured study extraction exists

6. Run the dry-run promotion gate:

```bash
npm run promotion:dry-run -- --pmid 42141930
```

or:

```bash
npm run promotion:dry-run -- <dedupe-key>
```

Promotion is not ready unless the dry run reports `ready=true`, no blockers, a claim id, a reference id, a reference URL, and study ids.
The dry run also emits `worksheet.readOnlyCommands` for packet, reference-match, sibling, curation-status, curation-draft, and rerun inspection.

7. Use the authenticated operator promotion control only after the dry run is ready and operator browser-control QA evidence has been recorded. The promotion note should summarize the human review decision and any remaining uncertainty labels.

## Do Not Promote When

- Candidate is pending, rejected, or not human-reviewed.
- Claim link is missing or points to the wrong claim.
- Structured extraction is missing or was not human-reviewed.
- `publicSourcePacketReady` is false.
- Promotion would imply medical advice, peptide sourcing, dosing, compounding, injection, cycling, or self-administration instructions.
- AU/TGA product-level status is being inferred from ingredient-level evidence.

## Evidence To Record

Before any public promotion, record outside the repo:

- candidate dedupe key
- accepted reference id
- linked claim id
- structured study id or ids
- dry-run promotion output
- reviewer/admin identity
- timestamp
- remaining caveats or uncertainty labels

Do not store private operator notes, credentials, OAuth secrets, database URLs, or unpublished source text in commits or public routes.
