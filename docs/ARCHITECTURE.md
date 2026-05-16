# Cocuyo — Architecture

## System Overview

External APIs → collectors → scorer → status.json → Cloudflare CDN → frontend
User tap → Supabase outage_reports → pipeline reads on next cron

## Three Layers

Layer 1 — DATA COLLECTION (cron every 10 min)
  Pulls from free external sources. No utility cooperation needed.
  Sources: IODA, Cloudflare Radar, OONI, NASA POWER, VIIRS, Supabase crowd

Layer 2 — ANALYSIS (runs after collection)
  scorer.py blends signals into 0-1 score per region.
  Writes status.json. Uploads to R2.

Layer 3 — STATIC FRONTEND (reads pre-computed JSON)
  Reads status.json from CDN. Users submit reports to Supabase.
  No server handles read requests.

## Directory Structure

/cocuyo
  CLAUDE.md
  CONTEXT.md
  .env.example
  /pipeline
    main.py
    scorer.py
    validation.py
    quorum.py
    cross_validation.py
    collector_internet.py
    collector_cloudflare.py
    collector_ooni.py
    collector_weather.py
    collector_viirs.py
    collector_internet_unified.py
    outage_type_classifier.py
    duration_estimator.py
    restoration_tracker.py
    zone_mapper.py
    calibration.py
  /app
    /components
      Map.tsx
      RegionCard.tsx
      ReportButton.tsx
      StatusBar.tsx
    /lib
      api.ts
    /pages
      index.tsx
  /models
  /tests
    test_validation.py
    test_quorum.py
    test_scorer.py
    test_cross_validation.py
    test_collector_cloudflare.py
  /docs
    SPEC.md          ← full original specification, all 22 sections
    ARCHITECTURE.md
    TASKS.md
    /adr
      001-static-json-cdn.md
      002-python-collectors-stateless.md
  /.github
    /workflows
      collect.yml

## Database Schema

Full runnable SQL (tables + RLS + functions + trigger): **docs/schema.sql**
Paste into Supabase Dashboard → SQL Editor and run once.

### Tables

| Table | Purpose |
|-------|---------|
| outage_reports | Raw user reports (crowd signal source) |
| outage_history | Completed outage events with duration + ML training fields |
| active_outages | Currently ongoing events, one row per region max |

outage_reports columns:
- id, created_at — auto
- region, status — required user input; status CHECK IN ('no_power','power_back','unstable')
- lat, lon, onset_type, symptom, device_fingerprint, city_freetext — optional user input
- ip_hash — TRIGGER-computed, never client-supplied; anon has no INSERT grant on this column
- state — pipeline-derived (REGION_TO_STATE in regions.py), not user input
- sub_zone, duration_min — null Phase 1-2; server-side only
- confirmed_by_passive — pipeline UPDATE via service_role after cross-validation (Phase 2+)

outage_reports indexes:
- idx_reports_recent (region, created_at DESC) — primary query path
- idx_reports_device (device_fingerprint, created_at DESC) — Phase 4 trust scoring
- idx_reports_ip_hash (ip_hash, created_at DESC) — rate limiting + RPC gate

outage_history + active_outages: see docs/schema.sql for full DDL.

### RLS

| Table | anon | service_role |
|-------|------|-------------|
| outage_reports | INSERT (restricted columns only) | full access (bypasses RLS) |
| outage_history | no access | full access |
| active_outages | no access | full access |

anon INSERT columns (GRANT-level restriction, not just policy):
  region, lat, lon, status, onset_type, symptom, device_fingerprint, city_freetext

Server-side only (no anon grant): ip_hash, state, sub_zone, duration_min, confirmed_by_passive

### DB Functions

**_get_ip_hash() → TEXT** (SECURITY DEFINER, not public)
  Extracts client IP from PostgREST request headers, returns SHA-256 hex.
  Header precedence: cf-connecting-ip → x-forwarded-for (leftmost) → x-real-ip → inet_client_addr()
  Returns NULL if no IP determinable.

**_trigger_set_ip_hash() → TRIGGER** (BEFORE INSERT on outage_reports)
  Calls _get_ip_hash() and sets NEW.ip_hash. Client cannot override.

**get_recent_count(p_region TEXT, p_minutes INT) → INTEGER** (callable by anon)
  Returns count of reports in region over last p_minutes.
  Anti-polling gate: returns NULL unless caller has a report inserted in last 60 seconds.
  Called by frontend after submission to show social proof.

## Scoring Weights (constant across phases)
internet:    0.35
crowdsource: 0.30
satellite:   0.20
weather:     0.15

## Scoring Formula (normalize by available signals)
current_score = sum(weight_i * signal_i) / sum(weight_i)
  where i ranges over signals that are not None.

None signals are excluded from both numerator and denominator.
A None signal is "absent" not "normal" — never treated as zero.

Phase 1 (crowd only):  score = (0.30 * crowd) / 0.30 = crowd
Phase 2 (inet+crowd):  score = (0.35 * inet + 0.30 * crowd) / 0.65
Phase 3+ (all four):   score = full weighted sum / 1.0

If all signals None: status "no_data", score 0.0.
See ADR-009 for rationale.

## Status Thresholds (locked)
< 0.25    → normal
0.25-0.45 → at_risk
0.45-0.70 → likely_outage
> 0.70    → confirmed_outage

## Signal Sources Per Layer

Passive (no user needed):
  IODA API          — BGP routing per ASN, latency minutes
  Cloudflare Radar  — HTTP traffic timeseries per ASN, 15min buckets
  OONI              — censorship vs connectivity loss distinction
  NASA POWER        — temperature + humidity → heat stress score
  VIIRS satellite   — nighttime lights vs baseline, ~12h latency

Active (requires users):
  Supabase crowd    — no_power / power_back / unstable reports with GPS

## Validation Pipeline (Phase 1-2: 5 layers)

Layer 1: IP rate limiting (3 per 30min, reject at 6)
Layer 2: Geolocation consistency check
Layer 3: Contradiction detection vs consensus
Layer 4: Dynamic quorum (weighted votes, zone diversity, IP diversity)
Layer 5: Cross-validation against passive signals (Phase 2+)

Phase 4 adds:
Layer 6: Device fingerprint rate limiting (pending stability analysis)
Layer 7: Device trust scoring (historical accuracy per fingerprint)

See ADR-005 for why device fingerprint is deferred.

## Collector Contract
Every collector must:
  - Accept no required arguments beyond env vars
  - Return a typed dict
  - Never raise — return {"error": str} on any failure
  - Have an offline mock test in /tests/

## status.json Schema (full skeleton — shipped from Phase 1)

Schema structure is locked from day one. Phases fill in fields
additively — null means "signal not yet available." Frontend must
handle null for any signal field. See ADR-001.

Phase 1 example (crowd-only, no passive signals):
{
  "updated_at": "2026-05-16T14:00:00Z",
  "phase": 1,
  "scheduler": "github-actions",
  "next_update_approx": "2026-05-16T14:10:00Z",
  "collector_errors": 0,
  "regions": {
    "maracaibo": {
      "display_name": "Maracaibo (Zulia)",
      "current_score": null,
      "prediction_score": null,
      "status": "unverified_reports",
      "signals": {
        "internet": null,
        "satellite": null,
        "crowdsource": 0.90,
        "weather": null
      },
      "crowd_reports_30min": 47,
      "prediction_text": null,
      "rationing_pattern": {
        "description": "Every other day (interdiario), 2-6h, usually after 1pm",
        "frequency": "interdiario",
        "typical_start_hour": 13,
        "typical_duration_hours": "2-6"
      }
    },
    "caracas": {
      "display_name": "Caracas (Distrito Capital)",
      "current_score": null,
      "prediction_score": null,
      "status": "no_data",
      "signals": {
        "internet": null,
        "satellite": null,
        "crowdsource": null,
        "weather": null
      },
      "crowd_reports_30min": 0,
      "prediction_text": null,
      "rationing_pattern": null
    }
  }
}

Phase 2+ example (passive signals active):
{
  "updated_at": "2026-07-15T16:30:00Z",
  "phase": 2,
  "scheduler": "cloudflare-worker",
  "next_update_approx": "2026-07-15T16:40:00Z",
  "regions": {
    "maracaibo": {
      "display_name": "Maracaibo (Zulia)",
      "current_score": 0.72,
      "prediction_score": 0.80,
      "status": "confirmed_outage",
      "signals": {
        "internet": 0.85,
        "satellite": 0.70,
        "crowdsource": 0.90,
        "weather": 0.66
      },
      "crowd_reports_30min": 47,
      "prediction_text": "Active outage confirmed by multiple sources"
    }
  }
}

Status field values by phase:
  Phase 1: "no_data" | "unverified_reports"
  Phase 2+: "normal" | "at_risk" | "likely_outage" | "confirmed_outage"

## Scheduler

Phase 1: GitHub Actions cron (*/10 * * * *)
  Limitation: 10-40 minute variance during peak hours, silent drops.
  Acceptable for Phase 1 data-collection mode.
  Pipeline must be idempotent — safe to run multiple times or skip runs.

Phase 2+: Reliable scheduler (decided at Phase 2 start)
  Option A: $5/mo VPS (Hetzner/similar) running pipeline in Docker
  Option B: Cloudflare Worker scheduled trigger (free, 1-min granularity)
  Requirement: <2min variance between scheduled and actual run time.
  GitHub Actions demoted to fallback or removed.

See ADR-008 for rationale.

## Regions Tracked (17 total)
caracas, maracaibo, valencia, barquisimeto, maracay,
ciudad_guayana, san_cristobal, merida, barinas,
maturin, cumana, punto_fijo, los_teques, porlamar,
barcelona, guarenas_guatire, valera