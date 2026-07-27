# Launch Alert Test Plan

Date: 2026-06-12
Status: complete

## Boundary

- Trigger a launch-safe alert test without changing app data, source candidates, operator writes, or public route behavior.
- Keep the test manual-only and clearly labeled as an intentional failure.
- Record only safe evidence: timestamp, workflow/run URL, and readiness status. Do not store credentials, alert payloads, or private notification contents.

## Steps

1. Add a manual GitHub Actions workflow on `main` that intentionally fails with an explicit launch-alert-test message.
2. Commit and push the workflow-only change to `main`.
3. Dispatch the workflow once and verify the run completes with the expected `failure` conclusion.
4. Record `APEX_ALERT_TESTED_AT` in the ignored local evidence file.
5. Update operations docs and run readiness/public smoke checks.

## Validation

- `npm run operations:readiness -- --env-file .env.vercel.preview.local --summary`
- `npm run operations:readiness -- --env-file .env.vercel.preview.local --evidence alert-test`
- `npm run launch:readiness -- --env-file .env.vercel.preview.local --summary`
- `npm run smoke:public-mvp -- https://apex-lifespan.vercel.app`
- `git diff --check`

## Result

- GitHub Actions repository execution was enabled after the first two dispatch attempts stayed queued while Actions was disabled.
- Workflow-only `main` commit: `8a9f642 Add launch alert test workflow`.
- Alert evidence run: `https://github.com/Smellybum1/Apex-Lifespan/actions/runs/27399894930`.
- Result: completed with the expected intentional `failure` conclusion at `2026-06-12T06:54:22Z`.
- Local evidence key recorded: `APEX_ALERT_TESTED_AT=2026-06-12T06:54:22Z`.
- No app deployment rollback, database write, ingestion write, source promotion, or operator write was executed by the alert test workflow.
