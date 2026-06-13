# Rollback Drill

## Goal

Rehearse the app/data rollback path without changing production traffic or mutating the managed database.

## Boundary

- Do not execute `vercel rollback`.
- Do not restore or overwrite the managed source database.
- Confirm rollback target selection, rollback command shape, and data rollback ownership from read-only evidence.
- Run public smoke after the rehearsal.

## Steps

1. Inspect the current production deployment.
2. Identify the previous Ready production deployment as the app rollback target.
3. Confirm Vercel rollback command support and that no rollback is already in progress.
4. Confirm data rollback path from the completed Neon restore rehearsal.
5. Run public smoke against the production domain.
6. Record `APEX_ROLLBACK_DRILL_REHEARSED_AT` only if the checks pass.

## Result

Completed on `2026-06-12T06:33:48.8062715Z`.

- Current production deployment: `https://apex-lifespan-8jobww3fi-tom-chanpheng-s-projects.vercel.app`, id `dpl_BCYNTeCWeGMbTFsfsEu7hToKxLBz`, Ready.
- App rollback target: previous Ready production deployment `https://apex-lifespan-9msbgyge0-tom-chanpheng-s-projects.vercel.app`, id `dpl_AaFPxRc6F4p2HYtw1iTd6qWso2iW`.
- Rollback command shape confirmed by `vercel rollback --help`: `vercel rollback <deployment id/url>`.
- Rollback status check: no deployment rollback in progress.
- Data rollback path: Neon PITR/restore process is documented and the backup restore rehearsal completed against a temporary non-production database.
- Public smoke after the rehearsal passed against `https://apex-lifespan.vercel.app`.
