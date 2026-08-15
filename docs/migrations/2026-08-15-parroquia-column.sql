-- Cocuyo — one-time migration: outage_reports.parroquia
-- ============================================================
-- WHY: the parroquia column (per-municipio crowd aggregation) was
-- added to docs/schema.sql in Phase 2 but never applied to the live
-- Supabase project. Until it runs:
--   • reports carrying parroquia fail with HTTP 400 (unknown column)
--   • the pipeline's parroquia select falls back to region-only mode
--
-- HOW: open Supabase Dashboard → SQL Editor → New query → paste →
-- Run. Takes 1 second. No downtime.
-- ============================================================

ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS parroquia TEXT;

-- anon must be able to INSERT the column (column-level grants do not
-- auto-extend to new columns in this schema's setup)
GRANT INSERT (parroquia) ON outage_reports TO anon;
