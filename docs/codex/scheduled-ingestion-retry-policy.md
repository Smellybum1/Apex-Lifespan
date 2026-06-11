# Scheduled Ingestion Retry Policy

Last updated: 2026-06-11

Use this policy before approving scheduled ingestion retries for the fully live product. It keeps retries explicit, bounded, and separate from source-candidate review or public evidence promotion.

## Policy

- Automatic retries remain disabled by default.
- Failed jobs must be reviewed by failure category before any retry decision.
- Retry runs may only process queued source-candidate ingestion jobs.
- Retry work must not accept or reject source candidates.
- Retry work must not link claims, extract studies, promote public evidence, or change reviewed public packets.
- PubMed and ClinicalTrials.gov retry runs must keep the scheduler caps: 20 source results per job and no more than 5 jobs per scheduled run.
- PubMed retry runs require `NCBI_TOOL` and `NCBI_EMAIL`.

## Failure Categories

- `missing-configuration`: fix configuration first, then rerun `npm run ingest:scheduled-dry-run`.
- `rate-limited`: wait for the source window to recover and review source policy before retry.
- `upstream-unavailable`: confirm the upstream is healthy before retry.
- `unsupported-source`: do not retry until implementation support is reviewed.
- `unknown`: inspect the failed job locally before deciding whether retry is appropriate.

## Approval Evidence

Record approval only after this policy is reviewed and the dry run reports no recent failed jobs awaiting review:

```bash
APEX_INGESTION_RETRY_POLICY_APPROVED_AT=<ISO timestamp>
```

After recording approval, rerun:

```bash
npm run ingest:scheduled-dry-run
npm run launch:readiness
```

Do not store raw failed-job errors, source API keys, database URLs, private operator notes, or unpublished source text in commits or public routes.
