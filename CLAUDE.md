# CLAUDE.md — Cocuyo Project Rules

## Stack (Locked — Do Not Change Without ADR)
- Backend: Python 3.11, no frameworks, pure scripts
- Frontend: Next.js 14 static export, Leaflet.js, TypeScript
- Database: Supabase (Postgres), accessed via supabase-py and REST API
- CDN: Cloudflare R2 for status.json output
- Cron: GitHub Actions (public repo = unlimited minutes)
- ML: XGBoost + scikit-learn, joblib for serialization
- Satellite processing: rasterio + numpy

## Architecture Rules
- The frontend NEVER talks to the backend directly
- The frontend reads ONE file: status.json from Cloudflare CDN
- The frontend writes ONE way: POST to Supabase REST API (reports only)
- The pipeline runs on cron, writes status.json, uploads to R2
- No server handles user read requests — ever
- All ML models are pickled to /models/ and loaded at runtime

## Coding Style
- Python: type hints everywhere, dataclasses for structured inputs
- No print() for logging — use Python logging module
- All API calls wrapped in try/except with explicit error return
- TypeScript: strict mode, no any types
- React: functional components only, no class components

## File Scope Rules
- Pipeline scripts: /pipeline/
- Frontend: /app/
- Models: /models/
- Docs: /docs/
- GitHub Actions: /.github/workflows/
- NEVER write credentials to any file — use environment variables only

## Naming Conventions
- Python files: snake_case
- TypeScript files: PascalCase for components, camelCase for utils
- Database columns: snake_case
- Outage status values: "no_power" | "power_back" | "unstable"
- Region keys: lowercase no spaces e.g. "maracaibo", "ciudad_guayana"

## Dependencies (Do Not Add Without Asking)
Python: requests, numpy, rasterio, supabase-py, xgboost, scikit-learn,
        pandas, joblib, boto3, python-dotenv
Node: next, react, react-dom, leaflet, react-leaflet, typescript,
      @types/react, @types/leaflet

## Never Do
- Never hardcode API keys, tokens, or credentials
- Never run the dev server or deploy during a coding session
- Never push to git
- Never modify the database schema without updating /docs/ARCHITECTURE.md
- Never add a Python dependency not in the list above without approval
- Never use device_fingerprint in validation logic until Phase 4 stability analysis is complete (ADR-005)
- Never use service_role key in frontend code (ADR-007)
- Never expose SUPABASE_SERVICE_ROLE_KEY in any client-side file
- Never change the static JSON architecture — it is a core design constraint

## Testing Philosophy
- Every collector function must have a mock-data test that runs offline
- scorer.py must have unit tests for edge cases: all signals None, all signals 1.0
- validation.py must have tests for each rejection/flag scenario

## Caveman Mode
ALWAYS active. All models. All tasks.
Never revert unless user says "stop caveman" or "normal mode".
Drop: articles, filler, pleasantries, hedging.
Keep: all technical substance, exact error messages, code blocks unchanged.
Pattern: [thing] [action] [reason]. [next step].

Exception: security warnings, destructive operations, multi-step sequences
where fragment order risks misread — use full prose for that part only,
then resume caveman.

## Skills Available
- /grill-with-docs  — planning and architecture sessions (use Opus)
- /caveman          — compressed mode for quick work (use Haiku)
- /tdd              — red-green-refactor for all logic modules (use Sonnet)
- /diagnose         — structured debugging loop (use Sonnet)
- /zoom-out         — re-orient to full system before new task
- /improve-codebase-architecture — run every 3 days
- /handoff          — end of session cleanup

## Model Selection
- Architecture / grilling / ADRs: claude-opus-4-5
- Implementation tasks: claude-sonnet-4-5
- Debug sessions: claude-sonnet-4-5

## Session Start Protocol
Every session:
1. Read CLAUDE.md + CONTEXT.md + current TASKS.md item
2. State understanding + risks + files affected
3. Wait for approval
4. Then implement

## Feedback Loops Required
These modules MUST have unit tests before implementation is considered done:
- pipeline/validation.py
- pipeline/quorum.py
- pipeline/scorer.py
- pipeline/cross_validation.py
- pipeline/collector_cloudflare.py

## Architecture Anti-Patterns (Never Do)
- Never let frontend call pipeline scripts directly
- Never let pipeline scripts import from app/
- Never add state to collectors — they are stateless functions
- Never return raw API responses — always parse to typed dicts
- Never block the main pipeline on a single collector failure

## Spec Reference
Full project specification lives at docs/SPEC.md.
Before implementing any module, read the relevant section.
The spec contains exact code patterns, API response formats,
and data schemas — do not invent these from scratch.
Reference the spec section number in commit messages.
e.g. "feat: collector_viirs.py (spec section 5.2)"

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Cocuyo Mobile**

Native Android and iOS apps for Cocuyo, Venezuela's power outage monitoring system. Built with React Native (Expo), the apps read the same `status.json` from CDN and submit reports to the same Supabase backend as the web app — but add push notifications, food spoilage timers, full offline mode, and WhatsApp sharing. Designed for trust: anonymous, open source, no government affiliation.

**Core Value:** Venezuelans get instant push notifications when power goes out or comes back in their zone, and can check outage status even without internet.

### Constraints

- **Tech stack**: React Native with Expo — shared React/TypeScript knowledge with web app
- **Data contract**: Must read same `status.json` format as web — no custom mobile API
- **Reports**: Must POST to same Supabase `outage_reports` table — no backend changes for submission
- **Privacy**: No user tracking, no analytics that identify individuals, no location storage
- **Keys**: Only `SUPABASE_ANON_KEY` in the app — never service_role key (ADR-007)
- **Push infra**: Firebase Cloud Messaging for Android, APNs via FCM for iOS
- **Deployment**: Expo EAS Build (cloud builds), EAS Submit (store submission), EAS Update (OTA)
- **Store fees**: Google Play $25 one-time, Apple Developer $99/year
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.11 (pinned in CI) / 3.12 (local venv) — pipeline, ML training, collectors
- TypeScript 5.x (strict mode) — frontend application
- JavaScript — Next.js config (`app/next.config.js`)
- SQL — database schema (`docs/schema.sql`)
## Runtime
- Python 3.11 (GitHub Actions `actions/setup-python@v5` pins `3.11`)
- Local dev venv at `.venv/` uses system Python 3.12.3
- No framework — pure module execution via `python -m pipeline.main`
- Node.js 22.22.1 (local)
- Browser — static HTML/JS/CSS bundle, no server
- Python: pip with `requirements.txt`
- Node: npm 10.9.4
- Lockfiles: `app/package-lock.json` present; no Python lockfile beyond pinned `requirements.txt`
## Frameworks
- Next.js 14.2.29 — React framework, configured for **static export** (`output: 'export'`)
- React 18.3.1 — UI rendering
- Leaflet 1.9.4 + react-leaflet 4.2.1 — interactive map
- Next.js CLI (`next build` → static export to `app/out/`)
- TypeScript compiler (via Next.js, `noEmit: true`)
- Python modules executed directly; `pipeline/main.py` is the entry point
- `python -m pipeline.main` invoked by GitHub Actions
- pytest (no version pinned in `requirements.txt`; present in local environment)
## Key Dependencies
- `supabase==2.10.0` — Supabase Python client for crowd report reads (service_role)
- `boto3==1.35.76` — AWS S3-compatible client for Cloudflare R2 uploads
- `requests==2.32.3` — HTTP calls to IODA, Cloudflare Radar, NASA APIs
- `xgboost==2.1.3` — Duration prediction ML model
- `scikit-learn==1.5.2` — Cross-validation, model evaluation
- `pandas==2.2.3` — Training data manipulation
- `numpy==1.26.4` — Numerical operations
- `joblib==1.4.2` — Model serialization (`models/*.pkl`)
- `python-dotenv==1.0.1` — `.env` loading for local dev
- `rasterio` — HDF5 satellite granule processing (Phase 3, TODO stub in `pipeline/collector_viirs.py:105`)
- `next==^14.2.29` — Static site generation
- `leaflet==^1.9.4` — Map rendering
- `react==^18.3.1` — UI framework
- `react-leaflet==^4.2.1` — Leaflet React bindings
- `typescript==^5` — Type checking
- `@types/leaflet==^1.9.8`, `@types/react==^18`, `@types/node==^20` — Type definitions
## Configuration
- `.env` file for local dev (not committed); `.env.example` documents all vars
- GitHub Actions Secrets + Environment (`environment: cocuyo`) for CI
- Key vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_API_TOKEN`, `NASA_TOKEN`, `COCUYO_PHASE`, `COCUYO_DRY_RUN`, `STATUS_JSON_PATH`
- `NEXT_PUBLIC_STATUS_URL` — CDN URL for `status.json` (default: `https://cdn.cocuyo.app/status.json`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe for client)
- No `.env` file present in `app/`; vars expected at build time
- `app/next.config.js` — static export, unoptimized images, trailing slash
- `app/tsconfig.json` — strict mode, ES2017 target, `@/*` path alias
## Platform Requirements
- Python 3.11+ (3.12 works locally)
- Node.js 18+ (22.x confirmed working)
- pip for Python deps; npm for Node deps
- `.env` file populated from `.env.example`
- GitHub Actions: ubuntu-22.04 runners (pipeline + retrain jobs)
- Frontend: static files served from Cloudflare (CDN/Pages) — no server required
- Pipeline: serverless execution on GitHub Actions cron (no persistent compute)
- `models/*.pkl` excluded from git; uploaded to R2 via `retrain` job
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Python: `snake_case.py` — all pipeline modules follow this (`collector_cloudflare.py`, `outage_lifecycle.py`, `cross_validation.py`)
- TypeScript components: `PascalCase.tsx` — (`RegionCard.tsx`, `MobileShell.tsx`, `ForecastCurve.tsx`)
- TypeScript utilities/libs: `camelCase.ts` — (`api.ts`, `demoData.ts`, `i18n.ts`, `theme.ts`)
- Test files: `test_<module>.py` — mirror the pipeline module name exactly
- Python: `snake_case` — `compute_region_score()`, `fetch_traffic_anomalies()`, `detect_outage_from_timeseries()`
- Python private helpers: `_snake_case` prefix — `_headers()`, `_check_ip_rate()`, `_threshold_status()`, `_parse_ts()`
- TypeScript: `camelCase` — `fetchStatus()`, `submitReport()`, `useAutoRefresh()`, `isOutageActive()`
- React hooks: `use` prefix — `useAutoRefresh`, `useApp`, `useRegionHistory`
- Python: `snake_case` — `crowd_score`, `inet_score`, `baseline_avg`
- TypeScript: `camelCase` — `statusColor`, `effectiveRegionKey`, `timerRef`
- Module-level constants: `_UPPER_SNAKE` for private (`_WEIGHTS`, `_PASSIVE_SIGNALS`, `_RATE_WINDOW_MIN`), `UPPER_SNAKE` for public (`CF_API`, `VE_ASNS`, `TIMEOUT_S`, `BASELINE_RADIANCE`)
- Python dataclasses: `PascalCase` — `RegionScore`, `ValidationResult`, `QuorumResult`, `RegionMeta`
- TypeScript interfaces: `PascalCase` with `I` omitted — `RegionEntry`, `StatusJson`, `OutageInfo`, `RegionSignals`
- TypeScript union types: string literal unions — `'no_power' | 'power_back' | 'unstable'`, `'high' | 'medium' | 'low'`
- Region keys: `lowercase_no_spaces` — `"maracaibo"`, `"ciudad_guayana"`, `"guarenas_guatire"`
- Status values: `snake_case` strings — `"no_power"`, `"power_back"`, `"unstable"`, `"confirmed_outage"`, `"likely_outage"`, `"at_risk"`, `"normal"`, `"no_data"`
## Code Style
- Python: no autoformatter configured; code is manually consistent at 4-space indentation
- TypeScript: no Prettier config detected; consistent 2-space indentation throughout `app/`
- Both languages: aligned assignment blocks used in constants for readability:
- TypeScript: `next lint` (ESLint via Next.js defaults); `strict: true` in `app/tsconfig.json`
- Python: no linting tool configured; type hints enforced by convention per CLAUDE.md
## Import Organization
- TypeScript: `@/*` maps to `./` in `app/tsconfig.json`, but components use relative paths in practice (`'../lib/api'`, `'../components/Map'`)
## Error Handling
## Logging
- `logger.debug()` for per-cycle computed values: `logger.debug("score=%.3f status=%s signals=%s", ...)`
- `logger.info()` for state transitions: `logger.info("active_outage created: region=%s event=%s", region, event_id)`
- `logger.warning()` for recoverable collector failures: `logger.warning("CF traffic_anomalies: %s", exc)`
- `logger.error()` for DB failures: `logger.error("backfill %s failed: %s", region, exc)`
- Format: `"<context_key>=<value>"` positional args, never f-strings in log calls
## Comments
- Section dividers use `# ── section name ─────────` (Python) or `// ── section name ─────────` (TypeScript) — consistent pattern across all files
- ADR references inline: `# Normalize by available signal weight — absent ≠ zero (ADR-009)`
- Phase deferral comments: `# Device fingerprint: deferred to Phase 4 per ADR-005`
- Business logic rationale: `# GPS absence lowers trust but never blocks the report (ADR-006).`
- TODO items always include phase and ADR reference
## Function Design
- Python: typed dataclasses (`RegionScore`, `ValidationResult`, `QuorumResult`) or plain dicts for API payloads
- TypeScript: typed interfaces or union `{ data: T | null; offline: boolean }` — never untyped objects
- Collectors always return empty list/dict on error, never `None` (avoids caller null-checks)
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Pipeline is a pure function (`run()`) invoked by GitHub Actions cron every 10 minutes
- Frontend never contacts the pipeline — reads a single static file from CDN
- All collector failures are isolated; one failure does not block others
- Status values flow one direction: pipeline writes, frontend reads
- User write path (reports) bypasses pipeline entirely: browser → Supabase REST
## Layers
- Purpose: Schedules and triggers the pipeline
- Location: `.github/workflows/collect.yml`
- Contains: Two jobs — `collect` (every 10 min) and `retrain` (weekly)
- Depends on: GitHub Actions scheduler
- Used by: Nothing (it is the trigger)
- Purpose: Gathers raw signals from external sources
- Location: `pipeline/collector_*.py`
- Contains: Stateless functions, each isolated with try/except
- Depends on: External APIs (Supabase, IODA, Cloudflare Radar, NASA LANCE, NASA POWER)
- Used by: `pipeline/main.py::_fetch_passive_signals()` and `_fetch_all_recent_reports()`
- Purpose: Validates and weights crowd reports before scoring
- Location: `pipeline/validation.py`, `pipeline/quorum.py`
- Contains: IP rate limiting, geo bounding box check, contradiction detection
- Depends on: `pipeline/regions.py` for Venezuela bounding box constants
- Used by: `pipeline/main.py::score_region()`
- Purpose: Blends multiple signals into a 0-1 outage probability
- Location: `pipeline/scorer.py`
- Contains: Weighted signal normalization (internet 35%, crowd 30%, satellite 20%, weather 15%)
- Depends on: Nothing — pure function
- Used by: `pipeline/main.py::score_region()`
- Purpose: Reconciles crowd vs passive signals, flags manipulation
- Location: `pipeline/cross_validation.py`
- Contains: 4-case decision matrix (all agree, crowd only, passive only, split)
- Depends on: Nothing — pure function
- Used by: `pipeline/main.py::score_region()`
- Purpose: Tracks outage events in Supabase (start, end, history)
- Location: `pipeline/outage_lifecycle.py`
- Contains: INSERT/DELETE to `active_outages` and `outage_history` tables
- Depends on: Supabase service_role client
- Used by: `pipeline/main.py::run()` (Phase 2+)
- Purpose: Specialized analysis (bajones, duration, restoration, calibration)
- Location: `pipeline/bajon_detector.py`, `pipeline/duration_estimator.py`, `pipeline/restoration_tracker.py`, `pipeline/calibration.py`
- Contains: Domain-specific detection algorithms
- Depends on: Nothing — pure functions or Supabase client
- Purpose: Delivers `status.json` to browsers at scale with no server
- Location: Cloudflare R2 bucket `cocuyo`, key `status.json`
- Contains: Snapshot of all 17 region states + metadata
- Depends on: Pipeline upload via `boto3` S3-compatible API
- Used by: Frontend `lib/api.ts::fetchStatus()`
- Purpose: Read-only display of status.json + report submission
- Location: `app/`
- Contains: Next.js static export, Leaflet map, 5-tab mobile shell
- Depends on: CDN `status.json`, Supabase REST API (anon key only)
- Used by: Browser
## Data Flow
### Primary Pipeline Cycle (every 10 min)
### User Report Submission
### Frontend Status Refresh
### Model Retraining (weekly)
## Key Abstractions
- Purpose: Canonical per-region output consumed by frontend
- Examples: `app/lib/api.ts:47` (TypeScript interface), `pipeline/main.py:246` (Python dict construction)
- Pattern: Both sides must stay in sync manually — no codegen
- Purpose: Single source of truth for 17 canonical region keys, display names, and coordinates
- Examples: `pipeline/regions.py:19`
- Pattern: All pipeline modules import from here; never define regions locally
- Purpose: Normalize outage score when some signals are absent (absent ≠ zero)
- Examples: `pipeline/scorer.py:7` — internet 0.35, crowd 0.30, satellite 0.20, weather 0.15
- Pattern: Denominator is sum of weights of available signals only
- Purpose: Structured output of per-report validation
- Examples: `pipeline/validation.py:22`
- Pattern: `accepted` bool + `weight` float — downstream consumes only accepted reports
- Purpose: Typed frontend contract for status.json
- Examples: `app/lib/api.ts:58`
- Pattern: All frontend components read from this — never call pipeline directly
## Entry Points
- Location: `pipeline/main.py:341` (`main()` function)
- Triggers: `python -m pipeline.main` via GitHub Actions cron
- Responsibilities: Full cycle — collect, validate, score, lifecycle, upload
- Location: `pipeline/main.py:282` (`run(now)` function)
- Triggers: Tests import and call directly with injected `now` datetime
- Responsibilities: Same as `main()` but returns dict, skips file write and R2 upload
- Location: `app/pages/index.tsx`
- Triggers: Browser loads the static export
- Responsibilities: Render MobileShell, manage tab state, mount region picker if no region selected
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
### Adding state to collectors
### Adding a new region outside `pipeline/regions.py`
### Blocking the pipeline on a single collector
## Error Handling
- Collector failures: `try/except Exception as exc` → log error → `collector_errors += 1` → return `None`/empty dict
- Validation rejections: Return `ValidationResult(accepted=False, ...)` — never raise
- Lifecycle failures: Wrapped in try/except in `main.py::run()` — logged, not fatal
- R2 upload failure: `sys.exit(1)` — triggers GitHub Actions failure email
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
