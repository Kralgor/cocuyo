# External Integrations

**Analysis Date:** 2026-05-24

## APIs & External Services

**Crowd Data (read):**
- Supabase — PostgreSQL database for crowd-sourced outage reports
  - SDK/Client: `supabase-py==2.10.0` (pipeline); raw REST + anon key (frontend)
  - Auth: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend); `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
  - Table read: `outage_reports` (pipeline fetches last 30 min per cycle)
  - RPC call: `get_recent_count(p_region, p_minutes)` (frontend, count display)
  - POST: `outage_reports` via REST API (frontend report submission, anon key only)

**Internet Signal (passive):**
- IODA (Georgia Tech) — BGP visibility + active probing for Venezuelan ASNs
  - SDK/Client: `requests` — no auth required
  - Endpoint: `https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/asn/{asn}`
  - Implementation: `pipeline/collector_internet.py`

- Cloudflare Radar — HTTP traffic timeseries + anomaly events for Venezuela
  - SDK/Client: `requests` with Bearer token
  - Auth: `CF_API_TOKEN` env var
  - Endpoints: `https://api.cloudflare.com/client/v4/radar/traffic_anomalies`, `/radar/http/timeseries`
  - Implementation: `pipeline/collector_cloudflare.py`, consumed by `pipeline/collector_internet_unified.py`

**Satellite Signal (passive, Phase 3 active):**
- NASA LANCE NRT (VIIRS nighttime lights) — power outage detection via radiance drop
  - SDK/Client: `requests` with Bearer token
  - Auth: `NASA_TOKEN` env var (NASA Earthdata account)
  - Endpoint: `https://cmr.earthdata.nasa.gov/search/granules.json` (granule discovery)
  - Dataset: VNP46A2NRT (Black Marble near-real-time)
  - HDF5 processing: planned via `rasterio` (Phase 3 stub — returns `None` currently)
  - Implementation: `pipeline/collector_viirs.py`

**Weather/Grid Stress (passive):**
- NASA POWER — daily weather data (temperature, humidity, precipitation) for grid stress scoring
  - SDK/Client: `requests` — no auth required (public API)
  - Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`
  - Parameters: `T2M_MAX`, `RH2M`, `PRECTOTCORR`
  - Implementation: `pipeline/collector_weather.py`

**Planned (Phase 3):**
- OONI (Open Observatory of Network Interference) — censorship detection
  - Status: stub placeholder in `pipeline/collector_internet_unified.py` (`ooni = {}`)
  - Not wired yet; classify_internet_situation() has the `censorship` case ready

## Data Storage

**Databases:**
- Supabase (Postgres)
  - Connection: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend)
  - Client: `supabase-py` (pipeline); raw REST (frontend)
  - Tables: `outage_reports`, `outage_history` (see `docs/schema.sql`)
  - RLS: Two-key model — service_role for pipeline reads, anon key for frontend writes only (ADR-007)

**File Storage:**
- Cloudflare R2 (S3-compatible)
  - Purpose: hosts `status.json` (the single file the frontend reads)
  - Auth: `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - Client: `boto3==1.35.76` with S3-compatible endpoint
  - Bucket: `cocuyo`
  - Keys: `status.json` (pipeline output), `models/duration_model.pkl`, `models/duration_features.pkl` (retrain job)
  - Cache-Control: `max-age=60, s-maxage=300`
  - Implementation: `pipeline/main.py:_upload_to_r2()`

**Model Serialization:**
- Local filesystem `models/` directory — `*.pkl` files excluded from git
  - `models/duration_model.pkl` — XGBoost regressor (outage duration prediction)
  - `models/duration_features.pkl` — feature column list for inference
  - Uploaded to R2 after training; downloaded at runtime (future: currently loaded locally)
  - Serialization: `joblib`

**Caching:**
- None — no Redis, Memcached, or in-process cache
- Cloudflare CDN edge caching for `status.json` (via Cache-Control header on R2 upload)

## Authentication & Identity

**Backend Auth:**
- Supabase `service_role` key — full access, used only in pipeline (GitHub Actions)
- Never exposed in frontend code (ADR-007, enforced in `CLAUDE.md`)

**Frontend Auth:**
- Supabase `anon` key — restricted to RLS-permitted operations only
- Embedded in client bundle as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Used for: POST to `outage_reports`, GET `get_recent_count` RPC
- No user authentication — anonymous report submission

**API Tokens:**
- `CF_API_TOKEN` — Cloudflare Radar (free, from `dash.cloudflare.com`)
- `NASA_TOKEN` — NASA Earthdata (free, from `urs.earthdata.nasa.gov`)

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent
- Pipeline errors logged via Python `logging` module (stdout in GitHub Actions)
- `collector_errors` counter included in `status.json` output for pipeline health visibility

**Logs:**
- Python `logging` module, `INFO` level, format: `%(asctime)s %(levelname)s %(name)s: %(message)s`
- GitHub Actions captures stdout/stderr per run
- No persistent log aggregation

## CI/CD & Deployment

**Hosting:**
- Frontend: Cloudflare (static files, domain `app.cocuyo.kralgor.com` referenced in workflow CORS history)
- Pipeline output: Cloudflare R2 CDN (`cdn.cocuyo.app/status.json`)
- Pipeline execution: GitHub Actions (public repo, unlimited minutes)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/collect.yml`
- `collect` job: every 10 minutes cron (`*/10 * * * *`), ubuntu-22.04, Python 3.11, 8-min timeout
- `retrain` job: weekly Sunday midnight UTC (`0 0 * * 0`), ubuntu-22.04, Python 3.11, 30-min timeout
- Both jobs use `environment: cocuyo` to load secrets
- Concurrency group prevents parallel collect runs; retrain runs independently
- `workflow_dispatch` inputs allow manual triggering of either job

## Environment Configuration

**Required env vars (pipeline):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — full DB access (backend only)
- `R2_ENDPOINT_URL` — Cloudflare R2 S3 endpoint
- `R2_ACCESS_KEY_ID` — R2 credentials
- `R2_SECRET_ACCESS_KEY` — R2 credentials
- `CF_API_TOKEN` — Cloudflare Radar API token (Phase 2+)
- `NASA_TOKEN` — NASA Earthdata token (Phase 3+)
- `COCUYO_PHASE` — integer 1-5 controlling which signals are active

**Optional env vars (pipeline):**
- `COCUYO_DRY_RUN=1` — skips R2 upload (local testing)
- `STATUS_JSON_PATH` — output path override (default: `status.json`)

**Required env vars (frontend build):**
- `NEXT_PUBLIC_STATUS_URL` — CDN URL for status.json
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

**Secrets location:**
- Production: GitHub Actions Environment `cocuyo` (Secrets + Variables tab)
- Local dev: `.env` file (gitignored), documented in `.env.example`

## Webhooks & Callbacks

**Incoming:**
- None — no webhook endpoints; frontend is a static export with no server

**Outgoing:**
- None — pipeline writes to R2 and Supabase directly; no webhooks triggered

---

*Integration audit: 2026-05-24*
