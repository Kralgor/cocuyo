-- ============================================================
-- Cocuyo — Supabase schema
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor).
-- Idempotent: CREATE IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS outage_reports (
    id                   BIGSERIAL PRIMARY KEY,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    region               TEXT NOT NULL,
    state                TEXT,                   -- pipeline-derived, not user input
    sub_zone             TEXT,                   -- null until Phase 3
    lat                  DOUBLE PRECISION,
    lon                  DOUBLE PRECISION,
    status               TEXT NOT NULL CHECK (status IN ('no_power', 'power_back', 'unstable')),
    duration_min         INTEGER,                -- not collected from users
    ip_hash              TEXT,                   -- set by trigger, never by client
    device_fingerprint   TEXT,
    onset_type           TEXT,                   -- null in Phase 1
    symptom              TEXT,                   -- null in Phase 1
    city_freetext        TEXT,                   -- for region = 'unlisted'
    confirmed_by_passive BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_reports_recent
    ON outage_reports (region, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device
    ON outage_reports (device_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_ip_hash
    ON outage_reports (ip_hash, created_at DESC);


CREATE TABLE IF NOT EXISTS outage_history (
    id               BIGSERIAL PRIMARY KEY,
    event_id         UUID NOT NULL,
    region           TEXT NOT NULL,
    sub_zone         TEXT,
    outage_type      TEXT,
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    duration_min     INTEGER,
    day_of_week      INTEGER,
    hour_started     INTEGER,
    temperature_c    REAL,
    humidity_pct     REAL,
    season           TEXT,
    inet_drop_depth  REAL,
    crowd_reports    INTEGER,
    zones_affected   INTEGER,
    predicted_dur    INTEGER,
    prediction_error INTEGER
);

CREATE INDEX IF NOT EXISTS idx_history_region
    ON outage_history (region, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_event
    ON outage_history (event_id);


CREATE TABLE IF NOT EXISTS active_outages (
    id            BIGSERIAL PRIMARY KEY,
    event_id      UUID NOT NULL,
    region        TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    outage_type   TEXT,
    last_score    REAL,
    last_updated  TIMESTAMPTZ DEFAULT NOW(),
    predicted_dur INTEGER
);

-- One active outage per region at most
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_region
    ON active_outages (region);
CREATE INDEX IF NOT EXISTS idx_active_event
    ON active_outages (event_id);


-- ============================================================
-- RLS
-- Enable on all tables. service_role bypasses RLS by default.
-- ============================================================

ALTER TABLE outage_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outage_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_outages   ENABLE ROW LEVEL SECURITY;

-- anon: INSERT only (column restriction enforced via GRANT below)
DROP POLICY IF EXISTS "anon_can_insert" ON outage_reports;
CREATE POLICY "anon_can_insert" ON outage_reports
    FOR INSERT TO anon
    WITH CHECK (true);

-- No SELECT policy for anon → returns 0 rows (RLS default-deny).
-- service_role reads freely (bypasses RLS).


-- ============================================================
-- COLUMN-LEVEL GRANTS
-- Restrict anon INSERT to user-supplied fields only.
-- ip_hash, state, sub_zone, confirmed_by_passive, duration_min
-- are server-side computed — anon must not supply them.
-- ============================================================

-- Remove blanket INSERT from anon (may not exist yet, ignore error)
REVOKE INSERT ON outage_reports FROM anon;

-- Grant only the columns the client is allowed to provide
GRANT INSERT (
    region,
    lat,
    lon,
    status,
    onset_type,
    symptom,
    device_fingerprint,
    city_freetext
) ON outage_reports TO anon;


-- ============================================================
-- HELPER: _get_ip_hash()
-- Extracts real client IP from PostgREST request headers and
-- returns its SHA-256 hex digest.
--
-- Header precedence (highest to lowest trust):
--   1. cf-connecting-ip   (Cloudflare strips spoofed duplicates)
--   2. x-forwarded-for    (leftmost = original client)
--   3. x-real-ip
--   4. inet_client_addr() (direct connection, no proxy)
--
-- Returns NULL if no IP can be determined.
-- Both the INSERT trigger and get_recent_count call this function
-- so the hashing is always identical.
-- ============================================================

CREATE OR REPLACE FUNCTION _get_ip_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    headers_json JSONB;
    ip_text      TEXT;
BEGIN
    -- Read PostgREST request headers (true = return NULL if not set)
    BEGIN
        headers_json := current_setting('request.headers', true)::JSONB;

        ip_text := trim(headers_json->>'cf-connecting-ip');

        IF ip_text IS NULL OR ip_text = '' THEN
            -- x-forwarded-for may be comma-separated; leftmost is the client
            ip_text := trim(split_part(
                coalesce(headers_json->>'x-forwarded-for', ''), ',', 1
            ));
        END IF;

        IF ip_text IS NULL OR ip_text = '' THEN
            ip_text := trim(headers_json->>'x-real-ip');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        ip_text := NULL;
    END;

    -- Fallback to direct connection address (no proxy path)
    IF ip_text IS NULL OR ip_text = '' THEN
        BEGIN
            ip_text := inet_client_addr()::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    IF ip_text IS NULL OR ip_text = '' THEN
        RETURN NULL;
    END IF;

    RETURN encode(digest(ip_text, 'sha256'), 'hex');
END;
$$;

-- Not a public API — revoke default PUBLIC execute
REVOKE ALL ON FUNCTION _get_ip_hash() FROM PUBLIC;


-- ============================================================
-- TRIGGER: set ip_hash on INSERT
-- BEFORE trigger so ip_hash is set before the row lands on disk.
-- Client cannot override it because anon lacks INSERT grant on
-- the ip_hash column (SECURITY DEFINER runs as table owner).
-- ============================================================

CREATE OR REPLACE FUNCTION _trigger_set_ip_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.ip_hash := _get_ip_hash();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION _trigger_set_ip_hash() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_ip_hash ON outage_reports;
CREATE TRIGGER trg_set_ip_hash
    BEFORE INSERT ON outage_reports
    FOR EACH ROW EXECUTE FUNCTION _trigger_set_ip_hash();


-- ============================================================
-- RPC: get_recent_count(p_region, p_minutes)
-- Returns count of reports in the given region over the last
-- p_minutes minutes.
--
-- Anti-polling gate: returns NULL unless the caller submitted
-- a report in the last 60 seconds. Prevents using this endpoint
-- as a free reconnaissance query.
--
-- Called by the frontend immediately after report submission to
-- show social proof ("You + X others reported in last 30 min").
-- ============================================================

CREATE OR REPLACE FUNCTION get_recent_count(p_region TEXT, p_minutes INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_hash  TEXT;
    report_count INTEGER;
BEGIN
    caller_hash := _get_ip_hash();

    -- Can't identify caller → refuse
    IF caller_hash IS NULL THEN
        RETURN NULL;
    END IF;

    -- Gate: caller must have a report inserted in the last 60 seconds
    IF NOT EXISTS (
        SELECT 1
        FROM outage_reports
        WHERE ip_hash    = caller_hash
          AND created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*)
    INTO report_count
    FROM outage_reports
    WHERE region     = p_region
      AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL;

    RETURN report_count;
END;
$$;

-- Allow anon to call this RPC via PostgREST
GRANT EXECUTE ON FUNCTION get_recent_count(TEXT, INT) TO anon;


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after applying the schema to confirm setup.
-- ============================================================

-- 1. Tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('outage_reports', 'outage_history', 'active_outages');

-- 2. RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('outage_reports', 'outage_history', 'active_outages');

-- 3. Trigger in place
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'outage_reports';

-- 4. Smoke test INSERT (run as anon / from Supabase client with anon key)
-- INSERT INTO outage_reports (region, status) VALUES ('maracaibo', 'no_power');
-- SELECT id, region, status, ip_hash FROM outage_reports ORDER BY id DESC LIMIT 1;
-- Expected: ip_hash is NOT NULL (trigger fired), state/sub_zone/confirmed_by_passive are defaults.
