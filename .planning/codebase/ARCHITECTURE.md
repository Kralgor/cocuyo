<!-- refreshed: 2026-05-24 -->
# Architecture

**Analysis Date:** 2026-05-24

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (cron every 10 min)               │
│                     `.github/workflows/collect.yml`                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ runs
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Pipeline Entry Point                              │
│                    `pipeline/main.py::run()`                         │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  Crowd       │  Internet    │  Satellite   │  Weather               │
│  Collector   │  Collector   │  Collector   │  Collector             │
│  (Supabase)  │  (IODA/CF)  │  (VIIRS)     │  (NASA POWER)          │
│ `main.py`    │`collector_   │`collector_   │`collector_             │
│              │internet_     │viirs.py`     │weather.py`             │
│              │unified.py`   │              │                        │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
       │                │              │              │
       ▼                ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Validation + Scoring + Cross-Validation                 │
│   `validation.py` → `quorum.py` → `scorer.py` → `cross_validation.py`│
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Lifecycle Manager + Status Builder                    │
│       `outage_lifecycle.py`        `main.py::build_status_json()`    │
└────────────────┬──────────────────────────────┬─────────────────────┘
                 │ writes                        │ uploads
                 ▼                               ▼
         Supabase DB                      Cloudflare R2
   (`active_outages`,               `status.json` (public CDN)
    `outage_history`)
                                               │
                                               │ fetch (browser)
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js Static Export                             │
│                    `app/` (deployed to CDN)                          │
│    `lib/api.ts::useAutoRefresh()` polls status.json every 10 min    │
│    `lib/api.ts::submitReport()` POSTs to Supabase REST (anon key)   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Pipeline runner | Orchestrates one full collection cycle | `pipeline/main.py` |
| Report validator | Validates, rate-limits, weights crowd reports | `pipeline/validation.py` |
| Quorum checker | Determines if crowd sample is statistically valid | `pipeline/quorum.py` |
| Region scorer | Blends weighted signals into 0-1 outage score | `pipeline/scorer.py` |
| Cross-validator | Reconciles crowd vs passive signal agreement | `pipeline/cross_validation.py` |
| Lifecycle manager | Tracks outage open/close events in Supabase | `pipeline/outage_lifecycle.py` |
| Region registry | Single source of truth for 17 canonical regions | `pipeline/regions.py` |
| Internet collector | IODA (BGP) + Cloudflare Radar signal | `pipeline/collector_internet_unified.py` |
| Satellite collector | NASA LANCE VIIRS nighttime lights | `pipeline/collector_viirs.py` |
| Weather collector | NASA POWER heat/humidity grid stress | `pipeline/collector_weather.py` |
| Bajon detector | Detects voltage instability wave events | `pipeline/bajon_detector.py` |
| Duration estimator | Conditional survival analysis for outage ETA | `pipeline/duration_estimator.py` |
| Restoration tracker | Multi-signal power-back detection | `pipeline/restoration_tracker.py` |
| Calibration | Weekly active-user estimation per region | `pipeline/calibration.py` |
| Frontend entry | Single-page app shell with tab routing | `app/pages/index.tsx` |
| API layer | Status fetch + report submit, typed interfaces | `app/lib/api.ts` |
| App context | Theme, language, region preference (localStorage) | `app/contexts/AppContext.tsx` |
| History loader | Per-region JSON history files from CDN | `app/lib/history.ts` |
| Theme system | Two themes (tinta/estudio), CSS variable injection | `app/lib/theme.ts` |
| i18n | Spanish/English string lookup | `app/lib/i18n.ts` |

## Pattern Overview

**Overall:** Serverless event-driven pipeline + static CDN frontend. No application server exists anywhere in the stack.

**Key Characteristics:**
- Pipeline is a pure function (`run()`) invoked by GitHub Actions cron every 10 minutes
- Frontend never contacts the pipeline — reads a single static file from CDN
- All collector failures are isolated; one failure does not block others
- Status values flow one direction: pipeline writes, frontend reads
- User write path (reports) bypasses pipeline entirely: browser → Supabase REST

## Layers

**Orchestration Layer:**
- Purpose: Schedules and triggers the pipeline
- Location: `.github/workflows/collect.yml`
- Contains: Two jobs — `collect` (every 10 min) and `retrain` (weekly)
- Depends on: GitHub Actions scheduler
- Used by: Nothing (it is the trigger)

**Collector Layer:**
- Purpose: Gathers raw signals from external sources
- Location: `pipeline/collector_*.py`
- Contains: Stateless functions, each isolated with try/except
- Depends on: External APIs (Supabase, IODA, Cloudflare Radar, NASA LANCE, NASA POWER)
- Used by: `pipeline/main.py::_fetch_passive_signals()` and `_fetch_all_recent_reports()`

**Validation Layer:**
- Purpose: Validates and weights crowd reports before scoring
- Location: `pipeline/validation.py`, `pipeline/quorum.py`
- Contains: IP rate limiting, geo bounding box check, contradiction detection
- Depends on: `pipeline/regions.py` for Venezuela bounding box constants
- Used by: `pipeline/main.py::score_region()`

**Scoring Layer:**
- Purpose: Blends multiple signals into a 0-1 outage probability
- Location: `pipeline/scorer.py`
- Contains: Weighted signal normalization (internet 35%, crowd 30%, satellite 20%, weather 15%)
- Depends on: Nothing — pure function
- Used by: `pipeline/main.py::score_region()`

**Cross-Validation Layer:**
- Purpose: Reconciles crowd vs passive signals, flags manipulation
- Location: `pipeline/cross_validation.py`
- Contains: 4-case decision matrix (all agree, crowd only, passive only, split)
- Depends on: Nothing — pure function
- Used by: `pipeline/main.py::score_region()`

**Lifecycle Layer:**
- Purpose: Tracks outage events in Supabase (start, end, history)
- Location: `pipeline/outage_lifecycle.py`
- Contains: INSERT/DELETE to `active_outages` and `outage_history` tables
- Depends on: Supabase service_role client
- Used by: `pipeline/main.py::run()` (Phase 2+)

**Ancillary Pipeline Modules:**
- Purpose: Specialized analysis (bajones, duration, restoration, calibration)
- Location: `pipeline/bajon_detector.py`, `pipeline/duration_estimator.py`, `pipeline/restoration_tracker.py`, `pipeline/calibration.py`
- Contains: Domain-specific detection algorithms
- Depends on: Nothing — pure functions or Supabase client

**CDN Artifact Layer:**
- Purpose: Delivers `status.json` to browsers at scale with no server
- Location: Cloudflare R2 bucket `cocuyo`, key `status.json`
- Contains: Snapshot of all 17 region states + metadata
- Depends on: Pipeline upload via `boto3` S3-compatible API
- Used by: Frontend `lib/api.ts::fetchStatus()`

**Frontend Layer:**
- Purpose: Read-only display of status.json + report submission
- Location: `app/`
- Contains: Next.js static export, Leaflet map, 5-tab mobile shell
- Depends on: CDN `status.json`, Supabase REST API (anon key only)
- Used by: Browser

## Data Flow

### Primary Pipeline Cycle (every 10 min)

1. GitHub Actions triggers `collect` job (`.github/workflows/collect.yml`)
2. `python -m pipeline.main` runs `main()` → `run(now)` (`pipeline/main.py:282`)
3. `_fetch_all_recent_reports()` queries Supabase `outage_reports` table, last 30 min (`pipeline/main.py:89`)
4. `_fetch_passive_signals()` calls internet, VIIRS, weather collectors in try/except isolation (`pipeline/main.py:112`)
5. For each of 17 regions, `score_region()` runs validation → quorum → scoring → cross-validation (`pipeline/main.py:176`)
6. `process_lifecycle()` updates `active_outages` / `outage_history` in Supabase (`pipeline/outage_lifecycle.py`)
7. `build_status_json()` assembles the output dict (`pipeline/main.py:265`)
8. `_upload_to_r2()` uploads `status.json` to Cloudflare R2 (`pipeline/main.py:154`)
9. Exit 0 on success; exit 1 only on R2 upload failure (GitHub Actions emails on this)

### User Report Submission

1. User taps report button in `app/components/mobile/ReportButtons.tsx`
2. `lib/api.ts::submitReport()` POSTs directly to `${SUPABASE_URL}/rest/v1/outage_reports` with anon key (`app/lib/api.ts:94`)
3. Supabase RLS accepts (anon key allows INSERT, blocks service_role operations)
4. Report sits in `outage_reports` table until next pipeline cycle picks it up

### Frontend Status Refresh

1. `app/pages/index.tsx` mounts → `useAutoRefresh()` hook fires (`app/lib/api.ts:127`)
2. `fetchStatus()` GETs `status.json` from CDN (`app/lib/api.ts:82`)
3. Next fetch scheduled from `next_update_approx` field in response; minimum 60s
4. No WebSocket, no SSE — pure polling from a static file

### Model Retraining (weekly)

1. GitHub Actions triggers `retrain` job Sunday midnight UTC
2. `python -m pipeline.train_duration_model` builds XGBoost survival model
3. `models/duration_model.pkl` and `duration_features.pkl` uploaded to R2

## Key Abstractions

**RegionEntry (status.json shape):**
- Purpose: Canonical per-region output consumed by frontend
- Examples: `app/lib/api.ts:47` (TypeScript interface), `pipeline/main.py:246` (Python dict construction)
- Pattern: Both sides must stay in sync manually — no codegen

**REGIONS registry:**
- Purpose: Single source of truth for 17 canonical region keys, display names, and coordinates
- Examples: `pipeline/regions.py:19`
- Pattern: All pipeline modules import from here; never define regions locally

**Signal weights (ADR-009):**
- Purpose: Normalize outage score when some signals are absent (absent ≠ zero)
- Examples: `pipeline/scorer.py:7` — internet 0.35, crowd 0.30, satellite 0.20, weather 0.15
- Pattern: Denominator is sum of weights of available signals only

**ValidationResult dataclass:**
- Purpose: Structured output of per-report validation
- Examples: `pipeline/validation.py:22`
- Pattern: `accepted` bool + `weight` float — downstream consumes only accepted reports

**StatusJson interface:**
- Purpose: Typed frontend contract for status.json
- Examples: `app/lib/api.ts:58`
- Pattern: All frontend components read from this — never call pipeline directly

## Entry Points

**Pipeline (automated):**
- Location: `pipeline/main.py:341` (`main()` function)
- Triggers: `python -m pipeline.main` via GitHub Actions cron
- Responsibilities: Full cycle — collect, validate, score, lifecycle, upload

**Pipeline (test-injectable):**
- Location: `pipeline/main.py:282` (`run(now)` function)
- Triggers: Tests import and call directly with injected `now` datetime
- Responsibilities: Same as `main()` but returns dict, skips file write and R2 upload

**Frontend:**
- Location: `app/pages/index.tsx`
- Triggers: Browser loads the static export
- Responsibilities: Render MobileShell, manage tab state, mount region picker if no region selected

**Model retrainer:**
- Location: `pipeline/train_duration_model.py`
- Triggers: `python -m pipeline.train_duration_model` via GitHub Actions weekly
- Responsibilities: Fetch history from Supabase, fit XGBoost model, serialize to `models/`

## Architectural Constraints

- **No server:** Frontend is `output: 'export'` (Next.js static) — no API routes, no SSR, no server component (`app/next.config.js:3`). Deploying to CDN only.
- **One-way data contract:** `status.json` is written by pipeline, read by frontend. No shared code, no imports across the boundary.
- **Service role key isolation:** `SUPABASE_SERVICE_ROLE_KEY` exists only in GitHub Actions secrets and `pipeline/main.py`. Never appears in `app/`. Frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` only (ADR-007).
- **Collector isolation:** Each collector in `_fetch_passive_signals()` is wrapped independently in try/except. A single collector failure increments `collector_errors` and does not abort others (`pipeline/main.py:112`).
- **Global state:** `REGIONS` dict in `pipeline/regions.py` is module-level read-only. `_RATIONING_PATTERNS` dict in `pipeline/main.py` is module-level read-only seed data. No mutable global state.
- **Phase gating:** `COCUYO_PHASE` env var (int) gates Phase 2+ features. Phase 1 = crowd only; Phase 2+ adds passive signals and lifecycle management (`pipeline/main.py:311`).
- **Exit codes:** Exit 0 on collector failures (logged, pipeline continues). Exit 1 only on R2 upload failure — this triggers GitHub Actions email alert (`pipeline/main.py:358`).
- **device_fingerprint deferred:** ADR-005 — never use `device_fingerprint` in validation logic until Phase 4. The field is submitted as `null` in report payloads (`app/lib/api.ts:108`).

## Anti-Patterns

### Frontend importing from pipeline

**What happens:** A developer adds `import` from `pipeline/` in `app/`
**Why it's wrong:** Frontend is a static export deployed to CDN. Python code cannot run in the browser. The boundary is enforced by deployment, not by module system.
**Do this instead:** Any data the frontend needs must be in `status.json`. Add it to `build_status_json()` in `pipeline/main.py`.

### Adding state to collectors

**What happens:** A collector caches results between calls or maintains connection objects at module level
**Why it's wrong:** Collectors are stateless by design (ADR-002). The pipeline runs fresh each GitHub Actions invocation — no persistent process.
**Do this instead:** Collectors receive inputs and return typed dicts. All I/O happens inside the function, not at import time.

### Adding a new region outside `pipeline/regions.py`

**What happens:** A region key is defined directly in a collector or scorer
**Why it's wrong:** `REGIONS` is the single source of truth. Duplicating region definitions causes drift between pipeline and status.json output.
**Do this instead:** Add the region to `pipeline/regions.py::REGIONS` only.

### Blocking the pipeline on a single collector

**What happens:** A collector raises an exception that propagates up and halts `run()`
**Why it's wrong:** One bad API response would kill all 17 region updates.
**Do this instead:** Wrap every external call in try/except, increment `collector_errors`, return `None` for the signal. See `_fetch_passive_signals()` in `pipeline/main.py:112`.

## Error Handling

**Strategy:** Fail-open with error counting. Collectors degrade gracefully; scoring continues with available signals. Only R2 upload failure is fatal (exit 1).

**Patterns:**
- Collector failures: `try/except Exception as exc` → log error → `collector_errors += 1` → return `None`/empty dict
- Validation rejections: Return `ValidationResult(accepted=False, ...)` — never raise
- Lifecycle failures: Wrapped in try/except in `main.py::run()` — logged, not fatal
- R2 upload failure: `sys.exit(1)` — triggers GitHub Actions failure email

## Cross-Cutting Concerns

**Logging:** `logging.getLogger(__name__)` in every pipeline module. `logging.basicConfig()` in `pipeline/main.py` — level INFO, format includes timestamp, level, module name. No print() statements.
**Validation:** Report validation is centralized in `pipeline/validation.py::ReportValidator`. No ad-hoc field checks in main.py.
**Authentication:** Two-key model (ADR-007) — service_role key in pipeline only, anon key in frontend only. Keys injected via environment variables, never hardcoded.

---

*Architecture analysis: 2026-05-24*
