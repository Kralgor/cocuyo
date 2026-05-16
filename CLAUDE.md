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
- Never implement Phase 5 features (Telegram bot, mobile app, economic tracker)
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