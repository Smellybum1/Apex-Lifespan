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

## Future Production Schedule

After production database, secrets, monitoring, and alerts are configured, attach the scheduler to a hosted cron. The cron target should run with `APEX_DATA_SOURCE=database`, database credentials, NCBI metadata, and write access only to ingestion-job/source-candidate tables.
