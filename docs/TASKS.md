# Cocuyo Tasks

## How to Use This File
One task at a time. Never start T-N+1 before T-N passes its Done When condition.

Before each task state:
- Files you will create or modify
- Risks or ambiguities
- What done looks like

After each task output:
✅ T-[N] complete — [one-line summary]
Files changed: [list]

## Task States
- [ ] not started
- [~] in progress
- [x] done
- [!] blocked — reason listed below task

## Blocked Task Protocol
If blocked output:
🚫 T-[N] blocked — [reason]
Options: [2-3 ways to unblock]
Wait for human decision before proceeding.

---

## Phase 1 — Crowdsource MVP (3-4 weeks)

### T-001: Supabase schema [x]
Create outage_reports, outage_history, and active_outages tables.
RLS policies: anon INSERT only (restricted columns), service_role SELECT.
DB function: compute ip_hash from request headers on INSERT.
RPC function: get_recent_count(region TEXT, minutes INT) → INTEGER.
  Returns COUNT(*) from outage_reports for given region/time window.
  Callable by anon. No direct table SELECT access.
Files: docs/ARCHITECTURE.md (add SQL + RLS + functions), run in Supabase dashboard
Done when: all three tables exist, indexes created, test INSERT works cleanly.
           RLS policies active and tested: anon INSERT works,
           anon SELECT rejected, service_role SELECT works,
           ip_hash populated by DB function not client.
           city_freetext column exists, anon RLS policy includes it as writable.
           active_outages has unique index on region (one active outage per region).
           get_recent_count RPC returns correct count, callable by anon.
           RPC returns null if no report from caller's IP in last 60 seconds
           (prevents reconnaissance polling without contributing).

### T-001B: pipeline/regions.py [x]
Single source of truth for all 17 region metadata.
Exports REGIONS dict: region_key → {display_name, state, lat, lon}.
Used by main.py (status.json generation), validation.py (bounding box),
and REGION_TO_STATE derivation for backfilling state column.
Files: pipeline/regions.py
Done when: all 17 regions defined with correct state, display_name,
           and approximate city-center lat/lon coordinates.

### T-002: pipeline/validation.py [x]
Implement ReportValidator class.
Methods: _check_ip_rate, _check_geo_consistency, _check_contradiction
(device_fingerprint rate limiting deferred to Phase 4 — see ADR-005)
Files: pipeline/validation.py, tests/test_validation.py
Done when: unit tests pass for all 3 rejection/flag scenarios.
           Device check explicitly stubbed with TODO comment referencing ADR-005.
           _check_geo_consistency: bounding box only (0.5-12.5N, 59.5-73.5W).
           Does not validate GPS vs claimed region. GPS absence = 0.7 weight
           penalty, not rejection.

### T-003: pipeline/quorum.py [x]
Implement compute_crowd_score and compute_quorum.
Post-quorum score = outage_ratio (no_power_weight / total_weight).
No diversity multiplier — diversity enforced by quorum gate itself.
Pre-quorum score dampened by (total_weight / min_reports) * 0.5.
min_zones check skipped when all sub_zones are null (Phase 1-2).
Null sub_zones must not block quorum.
Files: pipeline/quorum.py, tests/test_quorum.py
Done when: score=0 with 0 reports, correct dampening below threshold,
           post-quorum score equals outage_ratio directly.
           cold_start mode: fixed quorum of 3/2 IPs when ESTIMATED_ACTIVE_USERS is empty.
           Quorum met with all-null sub_zones (min_zones check bypassed).

### T-004: pipeline/scorer.py [x]
Implement compute_region_score. Internet and satellite can be None.
prediction_score always null — no heuristic prediction in Phase 1-3.
prediction_text always null. Both populated by Phase 4 trained model only.
Files: pipeline/scorer.py, tests/test_scorer.py
Done when: returns valid status for all 4 status levels with only crowd input,
           handles all-None signals without crashing.
           Returns "unverified_reports" status when no passive signals present.
           Normalization by available signals verified:
           crowd-only produces full 0-1 range,
           all-None returns no_data status with score 0.0,
           two-signal case reaches confirmed_outage threshold.
           prediction_score and prediction_text are null in output.
           Logs which signals were available each run.

### T-005: pipeline/main.py (skeleton) [x]
Orchestrates: pull crowd reports → score → write status.json → upload to R2.
Reads COCUYO_PHASE env var (default 1). Passes to scorer and other modules.
status.json includes phase, scheduler, updated_at, next_update_approx,
collector_errors (count of collectors that returned errors this run).
Includes static rationing_pattern per region from seed data (CONTEXT.md).
main.py exits non-zero only if R2 upload fails. Collector failures logged
but don't halt pipeline (ADR-002).
Files: pipeline/main.py
Done when: status.json written locally with correct full skeleton schema.
           All 17 regions present. Unavailable signals are null, not omitted.
           Regions with no reports have status: "no_data".
           Regions with quorum met have status: "unverified_reports".
           Top-level phase and collector_errors fields present in output JSON.
           rationing_pattern present for regions with known patterns, null otherwise.
           Exit code 0 when collectors fail, exit code 1 only on R2 upload failure.

### T-005B: tests/test_pipeline_integration.py [x]
End-to-end integration test for Phase 1 pipeline.
Feeds synthetic crowd reports through full chain:
  validation → quorum → scorer → status.json output
No external APIs, no Supabase — in-memory data only.
Asserts:
  - validation output shape accepted by quorum input
  - quorum output shape accepted by scorer input
  - scorer output matches status.json schema (all 14 regions,
    null signals, correct status values)
  - "no_data" when no reports, "unverified_reports" when quorum met
  - Full 0-1 score range reachable with crowd-only normalization
Files: tests/test_pipeline_integration.py
Done when: test passes with 0 reports, 2 reports (below quorum),
           and 10 reports (above quorum) for a single region.
           Output JSON validates against status.json schema.

### T-006: app/ Next.js scaffold [x]
Create project. Configure static export. Install Leaflet.
Leaflet must be dynamic import (lazy-loaded, not in initial bundle).
Initial paint chunk <200KB gzipped (status list, no map).
Total page weight <250KB gzipped.
PWA: service worker + manifest.json.
  Cache strategy: app shell cache-first, status.json network-first
  with cache fallback. Offline banner when serving cached data.
Next 14 config: `output: 'export'` in next.config.js (not `next export` CLI).
.gitignore must include: .env, .env.local, .env.*.local, node_modules, /out
Files: app/ directory, app/package.json, app/tsconfig.json, app/next.config.js,
       app/public/manifest.json, app/public/sw.js, app/.gitignore
Done when: next build produces static export in /out with no errors.
           Bundle analysis confirms Leaflet in separate chunk.
           Initial JS bundle <200KB gzipped.
           Service worker registers and caches shell on first visit.
           App loads from cache when offline (shows stale status + banner).
           .gitignore prevents .env files from being committed.

### T-007: app/components/Map.tsx [x]
Leaflet map of Venezuela, colored regions from status.json.
Phase 1: grey (no reports) or blue (unverified reports exist).
Phase 2+: green < 0.25, yellow 0.25-0.45, orange 0.45-0.70, red > 0.70.
Map is lazy-loaded via dynamic import — not in initial paint bundle.
Status list renders first, map appears after Leaflet chunk loads.
Files: app/components/Map.tsx
Done when: map renders locally with hardcoded mock status.json.
           Phase 1 map shows grey/blue only — no green/yellow/orange/red.
           Map component loaded via next/dynamic with ssr: false.

### T-008: app/components/ReportButton.tsx [x]
Two-tap UI in Phase 1: region → status → submit to Supabase REST.
onset_type and symptom not collected in Phase 1 (null). Added in Phase 2.
Region step: scrollable list of 17 cities + "My city isn't listed" option.
"Not listed" captures freetext city name + GPS, stored with region: "unlisted".
GPS requested after region selection (not before). GPS stored, not displayed.
No reverse geocoding dependency. sub_zone, state, onset_type, symptom all
null on insert in Phase 1.
After submission: calls get_recent_count RPC → shows "You + X others reported
in the last 30 minutes." Immediate social proof without pipeline delay.
Power-back shortcut: localStorage stores last report (region, status, timestamp).
If last report was "no_power" within 12h, show "Power back?" one-tap button
at top of page. Pre-filled with remembered region. Removes itself on submit.
Files: app/components/ReportButton.tsx
Done when: report appears in outage_reports table after tap.
           Two taps only — no onset_type or symptom questions.
           "unlisted" reports stored with freetext city and GPS if available.
           Post-submission count displayed from RPC response.
           "Power back?" shortcut appears when localStorage has recent no_power.
           Shortcut submits power_back in one tap and clears itself.

### T-009: app/lib/api.ts [x]
fetchStatus() from CDN. submitReport() to Supabase.
getRecentCount() calls RPC after submission.
useAutoRefresh(): reads next_update_approx from status.json, schedules
next fetch accordingly. Phase 1 default: 10 min. Manual refresh immediate.
Files: app/lib/api.ts
Done when: fetch and POST shapes verified. Auto-refresh interval adapts
           to next_update_approx. RPC call integrated.

### T-010: .github/workflows/collect.yml [x]
Cron every 10 minutes. Runs pipeline/main.py. All secrets as env vars.
concurrency: { group: "cocuyo-pipeline", cancel-in-progress: true }
Files: .github/workflows/collect.yml
Done when: workflow file validates cleanly.
           status.json includes updated_at, next_update_approx, scheduler fields.
           Concurrency group set — overlapping runs cancel the older one.

---

## Phase 2 — Passive Monitoring

### T-011: pipeline/collector_internet.py [x]
IODA BGP signals for 4 Venezuelan ASNs.
Files: pipeline/collector_internet.py, tests/test_collector_internet.py
Done when: returns dict with score 0-1 per ASN, handles timeout gracefully.

### T-012: pipeline/collector_cloudflare.py [x]
Traffic timeseries per ASN + anomaly detection.
Files: pipeline/collector_cloudflare.py, tests/test_collector_cloudflare.py
Done when: >60% drop correctly detected as detected: true in unit test.

### ~~T-013~~ — MOVED TO PHASE 3 (OONI deferred, see Phase 3 section)

### T-014: pipeline/collector_internet_unified.py [x]
Combines IODA + Cloudflare Radar (no OONI in Phase 2).
Returns one of 4 situation types: power_outage, isp_failure,
confirmed_disruption, normal. (censorship case deferred with OONI.)
Files: pipeline/collector_internet_unified.py, tests/test_unified.py
Done when: all 4 cases produce correct classification in unit tests.

### T-015: pipeline/cross_validation.py [x]
Reconciles crowd vs passive signals. Flags manipulation.
Side effect: when passive confirms outage in a region, UPDATE
outage_reports SET confirmed_by_passive = TRUE for matching
no_power reports in that region from last 30 minutes.
Uses service_role key (already has write access).
Files: pipeline/cross_validation.py, tests/test_cross_validation.py
Done when: Case 3 (crowd says outage, passive says no) returns
           flag: "possible_manipulation".
           Confirmed case backfills confirmed_by_passive on matching reports.

### T-016-PRE: Migrate to reliable scheduler [x]
GitHub Actions cron has 10-40min variance. Before Phase 2 passive signals
go live, pipeline must run on a reliable scheduler with <2min variance.
Options (decide at Phase 2 start):
  A) $5/mo VPS (Hetzner or similar) running pipeline in Docker
  B) Cloudflare Worker scheduled trigger (free, 1-min granularity)
Files: .github/workflows/collect.yml (remove or demote to fallback),
       new deployment config for chosen scheduler
Done when: pipeline runs on reliable scheduler with <2min variance.
           GitHub Actions cron removed or kept only as fallback.

### T-016: pipeline/main.py (full) [x]
Wire all collectors into scorer. Cross-validate. Write status.json.
Files: pipeline/main.py (update)
Done when: full pipeline run produces valid status.json for all 17 regions.

### T-016B: pipeline/outage_lifecycle.py [x]
Bridges raw reports → outage events → outage_history.
Runs each pipeline cycle. Responsibilities:
1. Detect new outage events from score transitions (normal → outage)
2. Track active outages in active_outages table (event_id, region,
   started_at, outage_type, last_score, last_updated)
3. Assign shared event_id (UUID) when simultaneous transitions detected
   across multiple regions (same pipeline cycle). Single-region outages
   get unique event_id.
4. On restoration (score drops back to normal + crowd power_back reports),
   write completed event to outage_history with actual duration
5. Compute prediction_error = actual_duration - predicted_duration (Phase 4)
Depends on: T-016 (full pipeline), T-015 (cross-validation)
Required by: T-023 (restoration_tracker), T-025 (duration model training)
Files: pipeline/outage_lifecycle.py, tests/test_outage_lifecycle.py
Done when: score transition normal→outage creates active_outages row,
           score transition outage→normal writes outage_history row,
           duration_min computed correctly from started_at to ended_at.
           Simultaneous multi-region transitions share one event_id.
           Classifier can query regions_per_event via event_id GROUP BY.

---

## Phase 3 — Satellite Data

### T-017: pipeline/collector_viirs.py [x]
NASA LANCE VNP46A2NRT nighttime lights vs baseline radiance per region.
Files: pipeline/collector_viirs.py, tests/test_collector_viirs.py
Done when: classify_ratio returns correct status for mock radiance values,
           handles missing granules gracefully.

### T-018: pipeline/collector_weather.py [x]
NASA POWER temperature + humidity → heat_stress_score 0-3.
Files: pipeline/collector_weather.py, tests/test_collector_weather.py
Done when: returns heat_stress_score for all 4 cities, handles API timeout.

### T-019: pipeline/zone_mapper.py [x]
Clusters GPS reports → learns feeder circuit boundaries.
Files: pipeline/zone_mapper.py, tests/test_zone_mapper.py
Done when: cluster_concurrent_reports groups overlapping GPS points correctly,
           haversine distance calculation verified against known coordinates.

### T-013: pipeline/collector_ooni.py [x]
Recent VE measurements, anomaly_rate computed.
Adds censorship detection case to collector_internet_unified.py.
Files: pipeline/collector_ooni.py, tests/test_collector_ooni.py
Done when: returns total_measurements, anomaly_rate, anomalies list.
           Unified collector updated to 5 situation types (adds censorship).

### T-020: pipeline/main.py (add satellite) [x]
Wire VIIRS + weather + OONI collectors into scorer. Update status.json schema.
Files: pipeline/main.py (update)
Done when: status.json includes satellite signal scores for all 17 regions.

---

## Phase 4 — Prediction + Classification

### T-021: pipeline/outage_type_classifier.py (simple — spec Section 8.1) [x]
Simple if/elif classifier using signals available in Phase 2:
inet_drop_national, inet_drop_regional, adjacent_regions_affected,
crowd_reports_count, time_since_last_outage_hours.
Produces: rationing, transmission_fault, national_blackout, unknown.
Files: pipeline/outage_type_classifier.py, tests/test_outage_classifier.py
Done when: all 4 types correctly classified in unit tests.
           check_rationing_pattern returns correct confidence for
           known regional patterns (Zulia interdiario, Tachira daily).

### T-022: pipeline/duration_estimator.py [x]
Conditional survival analysis on historical_durations.
Refines estimate as outage continues.
Files: pipeline/duration_estimator.py, tests/test_duration_estimator.py
Done when: survival_estimate returns p25/p50/p75 correctly,
           fallback_estimate handles sparse data,
           crowd_restoration_reports correctly reduces median estimate.

### T-023: pipeline/restoration_tracker.py [x]
Detects when power returns via crowd + inet recovery signals.
Files: pipeline/restoration_tracker.py, tests/test_restoration_tracker.py
Done when: "restored" status requires stable + at least 2 signals,
           "recovering" returned when only 1 signal present.

### T-024: pipeline/calibration.py [x]
Weekly recalibrate_active_users from Supabase analytics.
Files: pipeline/calibration.py
Done when: returns updated user count per region from distinct ip_hash count,
           multiplier applied correctly.

### T-025: train_duration_model.py [x]
XGBoost weekly retrain on outage_history table.
Also produces the prediction_score model — first time prediction_score
and prediction_text become non-null in status.json.
Files: pipeline/train_duration_model.py
Done when: model trains without error on mock DataFrame,
           pickled to models/duration_model.pkl,
           MAE printed to logs.
           prediction_score populated in status.json for first time.

### T-025B: pipeline/outage_type_classifier.py (full — spec Section 7) [x]
Replaces simple Phase 2 classifier with full 18-field OutageSignature
scoring system. Same file, same function name, richer implementation.
Adds types: feeder_fault, substation_fault, weather_damage.
Requires: zone_mapper.py (T-019), symptom data from crowd reports,
          weather collector (T-018) for storm/lightning/wind fields.
Files: pipeline/outage_type_classifier.py, tests/test_outage_classifier.py
Done when: all 6 outage types correctly classified from OutageSignature.
           Normalization verified (scores sum to 1.0).
           Existing Phase 2 tests still pass (backward compatible types).

### T-026: app/components/RegionCard.tsx [x]
Detail panel showing: outage type, elapsed time, ETA, confidence,
progress bar, nearby areas restoring.
Files: app/components/RegionCard.tsx
Done when: renders correctly with mock active outage JSON from spec section 8.

### T-027: app/components/StatusBar.tsx [x]
Top bar with national summary — how many regions out, worst status.
Files: app/components/StatusBar.tsx
Done when: renders correctly with mock status.json.

### T-028: .github/workflows/collect.yml (add weekly retrain) [x]
Add separate weekly cron job for train_duration_model.py.
Files: .github/workflows/collect.yml (update)
Done when: two separate jobs defined — collect (every 10min) and
           retrain (weekly Sunday midnight).

---

## Frontend Redesign — UI from docs/claudedesign

Design decisions locked in docs/handoff-2026-05-16.md (15 items).

### T-F01: Foundation (theme + i18n + context) [x]
Port theme system (tinta + estudio) and i18n string table from cocuyo-data.js.
Files: app/lib/theme.ts, app/lib/i18n.ts, app/contexts/AppContext.tsx,
       app/styles/globals.css, app/pages/_app.tsx
Done when: ThemeProvider wraps app, CSS vars update on theme switch,
           tt('key','es') returns Spanish strings, next/font loads all 3 fonts.

### T-F02: Primitives [x]
Port visualization components from cocuyo-viz.jsx to typed TSX.
Files: app/components/primitives/Fingerprint.tsx, SignalBar.tsx,
       FireflyDot.tsx, ForecastCurve.tsx, HistoryStrip.tsx,
       FrequencyTrace.tsx, SectionLabel.tsx, MiniStat.tsx, Chip.tsx,
       CrossServiceRow.tsx
Done when: each renders correctly with mock props in isolation.
           Fingerprint shows 4 wedges, ghosted wedges at 0.15 for null signals.

### T-F03: Mobile shell + tab navigation [x]
MobileShell layout with 5-tab bottom nav.
Files: app/components/mobile/MobileShell.tsx, TabBar.tsx, TabIcon.tsx,
       app/pages/index.tsx (rewrite)
Done when: 5 tabs switch content, active tab highlighted,
           mobile layout max-width centered on desktop.

### T-F04: Region picker [x]
First-launch full-screen picker (17 cities grouped by state).
Stores selection in localStorage `cocuyo_region`.
Files: app/components/mobile/RegionPicker.tsx
Done when: appears on first visit, selection persisted,
           title bar shows region name + tap to change.

### T-F05: ScreenZoneDetail (Mi zona — tab 1) [x]
Region status card + signal fingerprint + rationing pattern callout +
report buttons. Uses live status.json data for selected region.
Files: app/components/mobile/ScreenZoneDetail.tsx
Done when: renders with real status.json, shows crowd signal only (Phase 1),
           rationing pattern callout shown for regions that have one,
           3 ghosted fingerprint wedges with lock icon.

### T-F06: Report flow + power-back banner [x]
One-tap report → POST → inline confirmation + 60s undo + cooldown.
Power-back sticky banner when localStorage has no_power < 12h.
Files: app/components/mobile/ReportButtons.tsx,
       app/components/mobile/PowerBackBanner.tsx
Done when: report POST succeeds, get_recent_count displayed,
           undo link works within 60s, power-back banner appears/dismisses.

### T-F07: Map upgrade (tab 2) [x]
Firefly markers with pulse animation. Theme-aware tiles (dark/light).
Tap marker → switch to Mi zona with that region + back arrow.
Leaflet prefetched via requestIdleCallback after initial paint.
Files: app/components/Map.tsx (rewrite)
Done when: markers pulse on outage regions, tile layer matches theme,
           tap navigates to Mi zona, prefetch works.

### T-F08: Teaser screens (tabs 3-5) [x]
Static demo data at 50% opacity + "Próximamente" overlay for
Forecast, Bajones, History tabs.
Files: app/components/mobile/ScreenForecast.tsx,
       app/components/mobile/ScreenBajones.tsx,
       app/components/mobile/ScreenHistory.tsx
Done when: all 3 screens render demo visualizations with overlay,
           no live data wiring needed.

### T-F09: Settings (theme toggle + language) [x]
Simple settings panel or sheet: tinta/estudio toggle + es/en toggle.
Files: app/components/mobile/Settings.tsx
Done when: theme switch updates CSS vars + map tiles,
           language switch updates all strings.

---

## Phase 5 — Consequence Layers (Post-MVP)

### T-029: Food safety timer [x]
Temperature-adjusted thresholds for fridge/freezer/medications.
Files: app/components/FoodSafetyTimer.tsx
Done when: timers adjust correctly for ambient temp > 30C.

### T-030: Water supply prediction [x]
Tank depletion estimate based on outage duration + zone tank size data.
Files: pipeline/water_predictor.py, app/components/WaterStatus.tsx
Done when: "70% of users report water loss after 6h" logic verified.

### T-031: Medical vulnerability alerts [x]
Local device profile (never sent to server). Push notification
when prediction score > 60% for user's zone.
Files: app/components/MedicalAlerts.tsx
Done when: profile stored in localStorage only, notification triggers
           at correct threshold.

### T-032: Voltage quality / bajones tracker [x]
Aggregate "unstable" reports to detect instability waves before full outage.
Files: pipeline/bajon_detector.py, app/components/VoltageStatus.tsx
Done when: instability wave detected when >5 "unstable" reports
           in 15min window in same zone.

### T-033: Cross-service dashboard [x]
Unified view: electricity + water + internet + cell signal.
Files: app/components/CrossServiceDashboard.tsx
Done when: all four services shown with correlated status.