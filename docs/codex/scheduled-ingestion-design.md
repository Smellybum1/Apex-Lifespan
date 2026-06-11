# Scheduled Source Ingestion Design

Status: selected design for roadmap step 8. First implementation slice is dry-run only.

## Decision

Scheduled ingestion should run the existing source-candidate job queue, not create public evidence directly.

## Boundaries

- Scheduled jobs may queue or run source-candidate ingestion jobs only.
- Scheduled jobs must never accept/reject candidates, link claims, extract studies, promote public evidence, or alter reviewed public packets.
- Review and promotion remain explicit human-owned operator actions.

## Rate Limits

- Keep per-job PubMed `retmax` at or below the existing CLI cap of 20.
- Keep per-job ClinicalTrials.gov `pageSize` at or below the existing CLI cap of 20.
- Run a small batch per scheduled tick first: default 1 queued job, maximum 5 for scheduler mode until monitoring is in place.
- Use `NCBI_TOOL` and `NCBI_EMAIL` before enabling unattended PubMed runs.

## Failure Handling

- Existing job execution records `SUCCEEDED`, `FAILED`, or `SKIPPED` plus error text on `IngestionJob`.
- Scheduler reports queued, running, failed, and recent jobs before running.
- Do not retry failed jobs automatically until failure classes are reviewed; failed job reruns stay operator-triggered first.

## Dry Run

Use:

```bash
npm run ingest:scheduled-dry-run
```

The dry run reads ingestion-job status and prints the scheduler plan without queueing, running, or promoting anything.

The dry run also reports a structured policy review:

- PubMed `retmax` cap: 20.
- ClinicalTrials.gov `pageSize` cap: 20.
- Scheduler default/max batch: 1 queued job by default, 5 maximum.
- Automatic retries: disabled until failed job classes are reviewed.
- Automatic public promotion: disabled.
- NCBI metadata: reports whether `NCBI_TOOL` and `NCBI_EMAIL` are configured by variable name only.
- Hosted cron readiness: reports missing runtime evidence by variable name only and stays blocked until all of these are true:
  - `APEX_DATA_SOURCE=database`
  - managed non-local PostgreSQL `DATABASE_URL`
  - `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true`
  - `APEX_INGESTION_ALERTS_CONFIGURED=true`
  - `APEX_SCHEDULED_INGESTION_CRON_APPROVED=true`
  - `NCBI_TOOL` and `NCBI_EMAIL`
- Failure review: reports recent failed-job categories and retry dispositions without echoing raw error text. Automatic retry readiness remains false until failure classes are reviewed and an explicit retry policy is approved.

## Guarded Run

Use:

```bash
npm run ingest:scheduled-run
```

The guarded run still plans first. It runs queued source-candidate jobs only when all of these are true:

- The command is invoked with `--apply` through `npm run ingest:scheduled-run`.
- `APEX_SCHEDULED_INGESTION_WRITES_ENABLED=true`.
- `NCBI_TOOL` and `NCBI_EMAIL` are configured.
- No source-candidate ingestion job is already running.

The runner uses the same source caps as the policy review, does not retry failed jobs automatically, and does not promote candidates into public evidence.

## Future Production Schedule

After production database, secrets, monitoring, and alerts are configured, attach the scheduler to a hosted cron. The cron target should run with `APEX_DATA_SOURCE=database`, database credentials, NCBI metadata, and write access only to ingestion-job/source-candidate tables.

The current implementation does not expose a hosted HTTP write endpoint. Add one only after the readiness report is clean and operator approval is recorded.
