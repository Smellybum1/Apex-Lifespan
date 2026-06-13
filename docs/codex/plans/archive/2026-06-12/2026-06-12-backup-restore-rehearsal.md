# Backup Restore Rehearsal

## Goal

Rehearse restoring production-like Preview Neon data into an isolated non-production target without changing the source database or exposing secrets.

## Boundary

- Source: existing Preview Neon database from the ignored env evidence file.
- Target: temporary Neon database named for this rehearsal, created on the same non-production server.
- Do not print connection strings, raw rows, auth tokens, session tokens, or private data.
- Drop the temporary target after validation unless cleanup fails.

## Steps

1. Create a temporary restore database.
2. Apply committed Prisma migrations to the temporary target.
3. Copy table data from source to target in foreign-key-safe order.
4. Validate row-count parity and the database-backed dashboard read path.
5. Drop the temporary target and record `APEX_BACKUP_RESTORE_REHEARSED_AT` only if validation succeeds.

## Validation

- `npm run db:migrate:deploy` against the temporary target.
- SQL row-count parity for copied tables.
- Database-backed dashboard data smoke against the temporary target.
- `npm run operations:readiness -- --env-file .env.vercel.preview.local --summary`.

## Result

Completed on `2026-06-12T06:30:14.1738788Z`.

- Temporary target: `apex_restore_rehearsal_20260612062621`.
- Migrations: all 4 committed Prisma migrations applied.
- Copy validation: 18 application tables copied with row-count parity.
- Dashboard smoke: restored target returned `dataSource: database`.
- Cleanup: temporary target dropped; no `apex_restore_rehearsal_*` databases remained.
