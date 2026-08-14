# Technology Stack

**Analysis Date:** 2026-05-24

## Languages

**Primary:**
- Python 3.11 (pinned in CI) / 3.12 (local venv) — pipeline, ML training, collectors
- TypeScript 5.x (strict mode) — frontend application

**Secondary:**
- JavaScript — Next.js config (`app/next.config.js`)
- SQL — database schema (`docs/schema.sql`)

## Runtime

**Backend Environment:**
- Python 3.11 (GitHub Actions `actions/setup-python@v5` pins `3.11`)
- Local dev venv at `.venv/` uses system Python 3.12.3
- No framework — pure module execution via `python -m pipeline.main`

**Frontend Environment:**
- Node.js 22.22.1 (local)
- Browser — static HTML/JS/CSS bundle, no server

**Package Manager:**
- Python: pip with `requirements.txt`
- Node: npm 10.9.4
- Lockfiles: `app/package-lock.json` present; no Python lockfile beyond pinned `requirements.txt`

## Frameworks

**Frontend Core:**
- Next.js 14.2.29 — React framework, configured for **static export** (`output: 'export'`)
- React 18.3.1 — UI rendering
- Leaflet 1.9.4 + react-leaflet 4.2.1 — interactive map

**Build/Dev:**
- Next.js CLI (`next build` → static export to `app/out/`)
- TypeScript compiler (via Next.js, `noEmit: true`)

**Backend (no web framework):**
- Python modules executed directly; `pipeline/main.py` is the entry point
- `python -m pipeline.main` invoked by GitHub Actions

**Testing:**
- pytest (no version pinned in `requirements.txt`; present in local environment)

## Key Dependencies

**Critical (Python — `requirements.txt`):**
- `supabase==2.10.0` — Supabase Python client for crowd report reads (service_role)
- `boto3==1.35.76` — AWS S3-compatible client for Cloudflare R2 uploads
- `requests==2.32.3` — HTTP calls to IODA, Cloudflare Radar, NASA APIs
- `xgboost==2.1.3` — Duration prediction ML model
- `scikit-learn==1.5.2` — Cross-validation, model evaluation
- `pandas==2.2.3` — Training data manipulation
- `numpy==1.26.4` — Numerical operations
- `joblib==1.4.2` — Model serialization (`models/*.pkl`)
- `python-dotenv==1.0.1` — `.env` loading for local dev

**Planned but not yet installed:**
- `rasterio` — HDF5 satellite granule processing (Phase 3, TODO stub in `pipeline/collector_viirs.py:105`)

**Critical (Node — `app/package.json`):**
- `next==^14.2.29` — Static site generation
- `leaflet==^1.9.4` — Map rendering
- `react==^18.3.1` — UI framework
- `react-leaflet==^4.2.1` — Leaflet React bindings

**Dev (Node):**
- `typescript==^5` — Type checking
- `@types/leaflet==^1.9.8`, `@types/react==^18`, `@types/node==^20` — Type definitions

## Configuration

**Environment (backend):**
- `.env` file for local dev (not committed); `.env.example` documents all vars
- GitHub Actions Secrets + Environment (`environment: cocuyo`) for CI
- Key vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_API_TOKEN`, `NASA_TOKEN`, `COCUYO_PHASE`, `COCUYO_DRY_RUN`, `STATUS_JSON_PATH`

**Environment (frontend):**
- `NEXT_PUBLIC_STATUS_URL` — CDN URL for `status.json` (default: `https://cdn.cocuyo.app/status.json`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe for client)
- No `.env` file present in `app/`; vars expected at build time

**Build:**
- `app/next.config.js` — static export, unoptimized images, trailing slash
- `app/tsconfig.json` — strict mode, ES2017 target, `@/*` path alias

## Platform Requirements

**Development:**
- Python 3.11+ (3.12 works locally)
- Node.js 18+ (22.x confirmed working)
- pip for Python deps; npm for Node deps
- `.env` file populated from `.env.example`

**Production:**
- GitHub Actions: ubuntu-22.04 runners (pipeline + retrain jobs)
- Frontend: static files served from Cloudflare (CDN/Pages) — no server required
- Pipeline: serverless execution on GitHub Actions cron (no persistent compute)
- `models/*.pkl` excluded from git; uploaded to R2 via `retrain` job

---

*Stack analysis: 2026-05-24*
