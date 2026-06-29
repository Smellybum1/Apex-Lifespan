# Scheduled Ingestion Retry Policy

Reference-only legacy launch doc. Do not load during ordinary startup or local product work; use only when the user explicitly asks about hosted scheduled ingestion retries.

Last updated: 2026-06-12

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
npm run ingest:scheduled-dry-run -- --env-file <operations-env-file> --summary
npm run launch:readiness
```

Do not store raw failed-job errors, source API keys, database URLs, private operator notes, or unpublished source text in commits or public routes.

## Latest Approval Evidence

- Approval timestamp recorded locally: `2026-06-12T07:05:06Z`.
- Basis: non-production dry run reported zero recent failed jobs and no duplicate source identities before approval.
- Apply rehearsal remained manual-reviewed: automatic retries stayed disabled, the scheduler processed only queued source-candidate work, and no public evidence promotion occurred.
