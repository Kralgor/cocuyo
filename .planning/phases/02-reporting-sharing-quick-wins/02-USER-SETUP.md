# Phase 02: User Setup Required

**Generated:** 2026-06-12
**Phase:** 02-reporting-sharing-quick-wins
**Status:** Complete

Completed before Plan 02-01 close-out.

## Supabase Public App Config

| Value | Source | Destination |
|-------|--------|-------------|
| Supabase project URL | Supabase Dashboard > Project Settings > API > Project URL | `mobile/app.json` `expo.extra.supabaseUrl` |
| Supabase anon/public key | Supabase Dashboard > Project Settings > API > anon/public key | `mobile/app.json` `expo.extra.supabaseAnonKey` |

Only the anon/public key belongs in `mobile/app.json`. Never add a service-role key to the mobile app.

## Dashboard Configuration

Location: Supabase Dashboard > SQL Editor

Run:

```sql
ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS parroquia TEXT;
GRANT INSERT (parroquia) ON outage_reports TO anon;
```

## Verification

After completing setup, verify with:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'outage_reports'
  AND column_name = 'parroquia';
```

Expected result: one row for `parroquia`.

Optional anon insert verification: submit or POST an outage report with a `parroquia` value and confirm the stored row populates that column.

**Once complete:** reply `applied` so Plan 02-01 can create its SUMMARY and continue Phase 2.
