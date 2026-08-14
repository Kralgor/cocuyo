# Codebase Concerns

**Analysis Date:** 2026-05-24

---

## Tech Debt

**VIIRS satellite collector is a stub:**
- Issue: `_extract_region_radiance()` in `pipeline/collector_viirs.py` returns `None` unconditionally. The CMR granule list IS fetched (costing network time and NASA_TOKEN quota), but no HDF5 data is ever extracted. `satellite_score` is always `None` for all 17 regions.
- Files: `pipeline/collector_viirs.py:105`
- Impact: The 0.20-weight satellite signal is permanently absent from scoring. `scorer.py` handles `None` gracefully (normalizes by available signals), so no errors occur — the degradation is silent. Phase 2 runs without one-third of its passive signal budget.
- Fix approach: Implement rasterio HDF5 download + bbox pixel extraction in `_extract_region_radiance()` (spec section 5.2). Requires adding `rasterio` to `requirements.txt` (currently missing despite being listed in CLAUDE.md).

**`rasterio` is listed in CLAUDE.md allowed deps but absent from `requirements.txt`:**
- Issue: CLAUDE.md says rasterio is an approved Python dependency, but it does not appear in `requirements.txt`. The workflow installs only from requirements.txt.
- Files: `requirements.txt`, `CLAUDE.md`
- Impact: Phase 3 VIIRS implementation cannot be deployed without a requirements.txt update. Easy to miss since current code never imports it.
- Fix approach: Add `rasterio==1.3.x` to `requirements.txt` before Phase 3.

**`crowd_confidence` parameter accepted but never used in `cross_validate()`:**
- Issue: `cross_validate()` in `pipeline/cross_validation.py` accepts `crowd_confidence: str` as a parameter but never reads it. `main.py` always passes `"medium"` (hardcoded). The parameter is dead weight.
- Files: `pipeline/cross_validation.py:19`, `pipeline/main.py:214`
- Impact: If crowd score varies (high quorum vs low quorum), the cross-validation applies the same logic regardless. Slightly incorrect weighting in the 2-of-3 agreement case.
- Fix approach: Either use `crowd_confidence` to adjust `final_score` in Case 5, or remove the parameter to avoid the dead-code confusion.

**`bajon_detector.py`, `restoration_tracker.py`, `duration_estimator.py`, `water_predictor.py`, `calibration.py`, `zone_mapper.py`, `outage_type_classifier.py` are implemented but not wired into `main.py`:**
- Issue: Seven pipeline modules exist with full implementations and tests, but none are imported or called in `pipeline/main.py`. They are orphaned — not part of any active data flow.
- Files: `pipeline/main.py` (imports only: cross_validation, outage_lifecycle, quorum, regions, scorer, validation, and lazily the three Phase-2 collectors)
- Impact: `status.json` never contains `bajones_15min`, `wave_detected`, or `wave_severity`. The frontend `VoltageStatus` component and `ScreenBajones` tab show "no data" permanently. Duration estimates and water predictions are never computed.
- Fix approach: Wire these modules into `main.py`'s `score_region()` or `run()` function per the spec sections they implement.

**`collector_ooni.py` referenced in `docs/ARCHITECTURE.md` but the file does not exist:**
- Issue: `docs/ARCHITECTURE.md` lists `collector_ooni.py` in the directory structure. The file is absent. `collector_internet_unified.py` passes `ooni: dict = {}` (Phase 3 stub), so censorship detection never fires.
- Files: `docs/ARCHITECTURE.md`, `pipeline/collector_internet_unified.py:154`
- Impact: The censorship classification branch (`ooni_anomaly_rate > 0.3`) is unreachable code in production. Docs are misleading about what exists.
- Fix approach: Either create the stub file to match the architecture doc, or update the doc to reflect the Phase 3 deferral explicitly.

**`backfill_history.py` uses bare `from regions import REGIONS` (wrong import path):**
- Issue: `pipeline/backfill_history.py:30` uses `from regions import REGIONS` instead of `from pipeline.regions import REGIONS`. This script is designed to run as `python pipeline/backfill_history.py` from the repo root with `pipeline/` in the Python path — a fragile invocation convention that differs from the rest of the codebase.
- Files: `pipeline/backfill_history.py:30`
- Impact: Running the script with `python -m pipeline.backfill_history` (the correct module style) fails with ImportError. It only works when invoked directly with a `cd pipeline/` or a sys.path hack.
- Fix approach: Change to `from pipeline.regions import REGIONS` and update the usage doc.

**Static rationing patterns are duplicated in two files:**
- Issue: The `_RATIONING_PATTERNS` dict in `pipeline/main.py:51-76` and `_RATIONING_SCHEDULES` in `pipeline/outage_type_classifier.py:18-43` contain the same four region schedules with overlapping fields. If a schedule changes, both must be updated.
- Files: `pipeline/main.py:51`, `pipeline/outage_type_classifier.py:18`
- Impact: Risk of drift — one dict gets updated, the other doesn't. Already slightly inconsistent: `main.py` stores `typical_duration_hours` as a string (`"2-6"`), while `outage_type_classifier.py` stores `window_hours` as an int.
- Fix approach: Consolidate into `pipeline/regions.py` (or a new `pipeline/rationing.py`) and import from there.

**`seed_history.py` uses `print()` for terminal output instead of logging module:**
- Issue: `pipeline/seed_history.py:352,355` uses `print()`. CLAUDE.md prohibits `print()` in pipeline scripts.
- Files: `pipeline/seed_history.py:352,355`
- Impact: Minor — this script is a one-shot data seeder, not a cron module. But it violates the stated convention.
- Fix approach: Replace with `logger.info()`.

---

## Known Bugs

**`outage_lifecycle.py` closes outages that transition to `at_risk` — not only `normal`:**
- Issue: `_NORMAL_STATUSES = frozenset({"normal"})` in `pipeline/outage_lifecycle.py:17` means an outage is only closed when a region reaches `"normal"`. But `"at_risk"` is a transitional status (score 0.25–0.45) that the lifecycle ignores. A region could oscillate between `"likely_outage"` and `"at_risk"` without the lifecycle ever closing the event.
- Files: `pipeline/outage_lifecycle.py:17`, `pipeline/scorer.py:68-74`
- Trigger: When crowd reports partially clear but passive signals still show elevated signal (0.25–0.45 range). Outage event stays open indefinitely.
- Workaround: None currently. The `at_risk` status was likely intended as a "closing" status but wasn't added to `_NORMAL_STATUSES`.

**`detect_outage_from_timeseries()` silently produces wrong result when timeseries values are floats vs ints:**
- Issue: `pipeline/collector_cloudflare.py:116` calls `[v for v in values[:baseline_end] if v is not None]` — assumes values are numeric. Cloudflare Radar returns values as strings in some response variants. If strings slip through, `baseline_avg` becomes incorrect (string concatenation, not addition).
- Files: `pipeline/collector_cloudflare.py:127`
- Trigger: Cloudflare API response format change or unexpected data type in `httpRequests.values`.
- Workaround: The outer try/except in `fetch_traffic_timeseries_by_asn` would not catch this — the arithmetic would produce nonsense, not raise.

---

## Security Considerations

**`SUPABASE_ANON_KEY` is baked into the static export bundle:**
- Risk: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is embedded in the compiled JS served to every user. This is by design (anon key is public), but RLS is the only barrier. If RLS rules have a gap, the key provides direct table access.
- Files: `app/lib/api.ts:70`
- Current mitigation: ADR-007 enforces two-key model — anon key in frontend (write-only to `outage_reports`), service_role key only in pipeline. `service_role` key is confirmed absent from all frontend files.
- Recommendations: Periodically audit Supabase RLS policies. Add a Supabase dashboard alert if `outage_reports` INSERT rate per IP exceeds threshold.

**`ip_hash` is trigger-computed server-side but validation treats `None` ip_hash reports as valid:**
- Risk: `_check_ip_rate()` in `pipeline/validation.py:95` compares `r.get("ip_hash") == report.get("ip_hash")`. If a report arrives with `ip_hash=None` (Supabase trigger misfires or is bypassed), the rate-limit comparison `None == None` returns `True`, allowing unlimited same-IP reports to pass as distinct unique sources.
- Files: `pipeline/validation.py:95`, `pipeline/quorum.py:25`
- Current mitigation: `ip_hash` is set by a Postgres trigger (per `docs/ARCHITECTURE.md`), not client-supplied. Anon role has no INSERT grant on the column. Risk is low but not zero.
- Recommendations: Add a validation guard: reject reports where `ip_hash is None` before rate-limit check.

**No rate limiting at the Supabase REST layer:**
- Risk: Any client can POST to `/rest/v1/outage_reports` at arbitrary rate. The only throttle is the pipeline's 30-minute validation window, which sees the flood retrospectively, not in real time.
- Files: `app/lib/api.ts:101`
- Current mitigation: IP rate limiting in `validation.py` (6 reports/30min hard limit per IP hash). Cross-validation with passive signals discards crowd floods (Case 3 in `cross_validate()`).
- Recommendations: Consider Supabase Edge Function rate-limiting middleware for Phase 2.

---

## Performance Bottlenecks

**`calibration.py` fetches all 30-day `outage_reports` rows into Python memory:**
- Problem: `recalibrate_active_users()` selects `region,ip_hash` for 30 days of reports with no server-side aggregation. As the table grows, this is an unbounded memory read.
- Files: `pipeline/calibration.py:37`
- Cause: Python-side `defaultdict` dedup instead of `SELECT region, COUNT(DISTINCT ip_hash)`.
- Improvement path: Replace with a Supabase RPC (Postgres function) that does `GROUP BY region` and returns the counts directly. Eliminates the data transfer entirely.

**Cloudflare Radar fetches are sequential across 4 ASNs:**
- Problem: `collect_all_internet_signals()` in `pipeline/collector_internet_unified.py:150-153` loops over `VE_ASNS` and calls `fetch_traffic_timeseries_by_asn()` sequentially. Each call has a 15-second timeout.
- Files: `pipeline/collector_internet_unified.py:150-153`
- Cause: Simple for-loop, no concurrency.
- Improvement path: Use `concurrent.futures.ThreadPoolExecutor` to fetch all 4 ASNs in parallel. Could save 30-45 seconds in the 8-minute GitHub Actions timeout window.

**Weather collector calls NASA POWER 4 times sequentially:**
- Problem: `fetch_weather_stress()` in `pipeline/collector_weather.py` calls NASA POWER once per city (4 cities) with 30-second timeouts each — up to 120 seconds worst-case.
- Files: `pipeline/collector_weather.py`
- Cause: Sequential requests.Session calls.
- Improvement path: Parallelize with ThreadPoolExecutor. Alternatively, the NASA POWER API supports multi-point queries.

**GitHub Actions timeout is 8 minutes; collector worst-case exceeds it:**
- Problem: The `collect` job has `timeout-minutes: 8`. Worst-case sequential execution: IODA (4 × 15s) + Cloudflare (4 × 15s + 1 × 15s) + NASA POWER (4 × 30s) + VIIRS CMR (1 × 20s) = up to 295 seconds (4.9 min) for collectors alone, before any Python overhead or Supabase query. Under network stress (common in this use case), timeouts stack.
- Files: `.github/workflows/collect.yml:29`
- Cause: Sequential collectors + generous individual timeouts.
- Improvement path: Parallelize collectors (see above). Alternatively, tighten individual TIMEOUT_S values.

---

## Fragile Areas

**`outage_lifecycle.py` — no idempotency guard on double-run:**
- Files: `pipeline/outage_lifecycle.py`
- Why fragile: If GitHub Actions runs two overlapping pipeline cycles (concurrency cancel-in-progress helps but the cancel is not instantaneous), `_create_active_outage()` could INSERT a duplicate row for the same region. The `active_outages` table likely has no UNIQUE constraint on `region` (schema in `docs/schema.sql` not verified here).
- Safe modification: Add a `.upsert()` or check-then-insert pattern in `_create_active_outage()`.
- Test coverage: `test_outage_lifecycle.py` tests transitions but not double-run scenarios.

**`bajon_detector.py` threshold is exclusive (>5 means >=6) but comment says >5:**
- Files: `pipeline/bajon_detector.py:17-18`
- Why fragile: `WAVE_THRESHOLD = 5` and `detected = count > threshold` means 6 reports are needed. The module docstring says ">5 reports" which is correct but the inline comment `# reports needed to declare a wave (exclusive: >5 means >=6)` is a workaround for an off-by-one. Anyone changing the threshold must also update the severity band tuples `_SEV_MILD = (6, 10)` — not obvious.
- Safe modification: Change to `WAVE_THRESHOLD = 6` (inclusive) and `count >= threshold` for clarity.

**`demoData.ts` hard-codes a date anchor of 2026-05-16:**
- Files: `app/lib/demoData.ts:27`
- Why fragile: `HIST_30D` generates 30 demo history days anchored to `new Date(2026, 4, 16)`. As calendar time advances, the demo data will show dates in the past with increasing distance from "today." For users viewing the app in late 2026+, the demo history strip will show dates 6-12+ months ago.
- Safe modification: Change `today` to `new Date()` (actual current date) so the 30-day demo window stays relative to the current date.

**`validate()` calls `_check_device_fingerprint()` but discards result via `_ =`:**
- Files: `pipeline/validation.py:75`
- Why fragile: The stub call `_ = self._check_device_fingerprint(report)` exists to maintain the method in the class, but the result is explicitly discarded. If someone adds Phase 4 logic to the method and forgets to update the call site, the check silently has no effect.
- Safe modification: When implementing Phase 4, replace the `_ =` assignment with the actual integration into `flags`.

**`sw.js` cache version is hardcoded as `cocuyo-shell-v1`:**
- Files: `app/public/sw.js:10-11`
- Why fragile: Cache bust requires incrementing `SHELL` and `DATA` strings manually. There is no build-time version injection. If the app shell changes without updating the cache key, returning users may serve a stale shell.
- Safe modification: Integrate a build-time hash into the cache key names (e.g., via Next.js build ID).

---

## Scaling Limits

**Internet signal is national, not regional (ADR-003):**
- Current capacity: One `internet_score` value applied identically to all 17 regions.
- Limit: Cannot distinguish a Maracaibo-only ISP failure from a national event. All 17 regions move together on the internet axis.
- Scaling path: Phase 4 — use historical outage patterns by grid priority tier to weight per-region internet signal application.

**Quorum threshold is fixed at 3 reports / 2 unique IPs for all 17 regions (ADR-004):**
- Current capacity: Works for early low-traffic phase. A fixed threshold is equally easy to meet in Caracas (high population) and Valera (low population).
- Limit: Once user base grows, Caracas quorum may be met by noise while Valera remains perennially borderline.
- Scaling path: `calibration.py` computes per-region active user estimates. Wire these into `quorum.py` to scale thresholds dynamically once sufficient reporter history exists.

---

## Dependencies at Risk

**`supabase-py` pinned at `2.10.0` with no upper bound:**
- Risk: Supabase Python client has had breaking API changes between minor versions. `requirements.txt` pins the exact version, which is correct. The risk is that this dependency is tightly coupled to Supabase's REST/RealTime API — a Supabase platform change could break the integration without a package version change.
- Impact: `_fetch_all_recent_reports()` and all `client.table().select().execute()` call chains.
- Migration plan: Monitor Supabase changelog. Consider adding integration tests that run against a local Supabase docker container to catch breakage early.

**`xgboost==2.1.3` — model artifacts are not version-stamped:**
- Risk: `models/` directory is empty (no trained models present). When training runs, it pickles a `XGBRegressor` with `joblib`. If xgboost is upgraded, existing pickles may not deserialize correctly.
- Files: `pipeline/train_duration_model.py:69`, `pipeline/train_duration_model.py:76`
- Impact: `load_model()` would raise on deserialization, causing `prediction_score` to stay `None` in `status.json` indefinitely.
- Migration plan: Store xgboost version alongside model pickle. Add a version check in `load_model()` before deserialization.

---

## Missing Critical Features

**Bajones data absent from `status.json`:**
- Problem: `bajon_detector.py` is implemented and tested but never called in `main.py`. `status.json` never contains `bajones_15min`, `wave_detected`, or `wave_severity` for any region.
- Blocks: The `ScreenBajones` tab and `VoltageStatus` component always show "no data" in production. The bajones tab is a primary navigation item that currently has no live data.

**Duration estimates and water depletion predictions never computed:**
- Problem: `duration_estimator.py` and `water_predictor.py` are implemented but not wired into the pipeline. `outage.estimated_remaining`, `outage.estimated_restoration` in the `RegionEntry` type are never populated.
- Blocks: The `OutageInfo` fields `estimated_remaining`, `estimated_restoration`, and `progress_pct` are always absent from `status.json`. Frontend components that consume these fields always fall through to their "no data" branches.

**No trained duration model exists yet:**
- Problem: `models/` directory is empty. `train_duration_model.py` requires at least 2 rows in `outage_history` to fit (skips CV below that). The model cannot be trained until the system has observed at least a few completed outages.
- Blocks: `prediction_score` in `status.json` will be `None` for an unknown period after launch. This is expected but means Phase 4 features are blocked on real outage data accumulation.

---

## Test Coverage Gaps

**`outage_lifecycle.py` — no test for double-run / idempotency:**
- What's not tested: Two consecutive pipeline runs both seeing the same region in outage state. Expected: second run does not duplicate the INSERT.
- Files: `tests/test_outage_lifecycle.py`
- Risk: Duplicate `active_outages` rows could cause `process_lifecycle()` to compute incorrect `restorations` list on next run.
- Priority: High

**`bajon_detector.py` not wired to main — integration path untested:**
- What's not tested: `detect_waves()` output being incorporated into `score_region()` output dict. Unit tests exist for the detector itself (`tests/test_bajon_detector.py`) but the integration path (reading `unstable` crowd reports → calling `detect_waves()` → writing to `status.json`) has no test.
- Files: `tests/test_pipeline_integration.py`
- Risk: When wired in Phase 3, silent breakage in the data shape could go undetected.
- Priority: Medium

**`calibration.py` — no test for the `recalibrate_active_users()` function:**
- What's not tested: Return value shape, the multiplier math, empty result on Supabase failure, regions with no reporters.
- Files: `pipeline/calibration.py`, no corresponding test file found.
- Risk: If calibration query fails silently (returns `{}`), quorum thresholds never update. No test catches this regression.
- Priority: Medium

**`collector_weather.py` — test file exists (`test_collector_weather.py`) but CLAUDE.md required modules are not all covered:**
- What's not tested: Specifically `_parse_city_response()` with malformed JSON shapes (missing `properties.parameter` key, non-numeric values).
- Files: `tests/test_collector_weather.py`, `pipeline/collector_weather.py`
- Risk: Silent `None` return from `_parse_city_response()` drops a city from `weather_data`; hard to diagnose without explicit coverage.
- Priority: Low

---

*Concerns audit: 2026-05-24*
