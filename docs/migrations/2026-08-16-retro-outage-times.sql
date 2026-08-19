-- Cocuyo — one-time migration: retroactive outage times
-- ============================================================
-- WHY: let users report an outage that happened earlier (e.g. "the
-- light went out from 4pm to 6pm today") instead of only "right now".
-- Adds optional started_at / ended_at to outage_reports.
--
--   started_at  → when the outage began (NULL = "right now", default)
--   ended_at    → when it ended (NULL = still ongoing / unknown)
--
-- The report's created_at still drives the 30-min recency window;
-- these columns store the user's stated outage window for history.
--
-- HOW: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================

ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

GRANT INSERT (started_at, ended_at) ON outage_reports TO anon;
