-- Cocuyo — one-time migration: reject non-Venezuelan coordinates
-- ============================================================
-- WHY: submissions carry optional GPS coordinates. Reports with
-- coordinates outside Venezuela (noise, tests, abuse from abroad)
-- were stored in the DB even though the pipeline later rejected them
-- at scoring time.
--
-- This CHECK constraint rejects them at INSERT time instead:
--   • lat/lon both NULL  → allowed (GPS absent — manual fallback, ADR-006)
--   • lat/lon inside VE  → allowed
--   • lat/lon outside VE → INSERT fails with a constraint violation
--
-- Bounding box matches pipeline/regions.py (VE_LAT_MIN/MAX, VE_LON_MIN/MAX):
--   lat 0.5–12.5, lon −73.5 to −59.5  (generous margins for GPS error;
--   may include slivers of neighboring countries near the border)
--
-- HOW: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================

ALTER TABLE outage_reports
DROP CONSTRAINT IF EXISTS chk_outage_reports_lat_lon_ve;

ALTER TABLE outage_reports
ADD CONSTRAINT chk_outage_reports_lat_lon_ve CHECK (
    (lat IS NULL AND lon IS NULL)
    OR (lat IS NOT NULL AND lon IS NOT NULL
        AND lat BETWEEN 0.5 AND 12.5
        AND lon BETWEEN -73.5 AND -59.5)
);
