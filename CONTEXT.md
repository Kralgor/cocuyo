# Cocuyo — Domain Context

## The Problem
Corpoelec (state utility) publishes no outage data. Venezuelans have zero
information when power goes out: cause, duration, or ETA.

## Grid Terminology
- **Apagón**: full power outage
- **Bajón**: voltage sag/surge — damages appliances, PRECEDES outages
- **Rationing / PAC**: scheduled load shedding by Corpoelec
- **Administración de cargas**: official term for rationing
- **Interdiario**: every other day (Zulia's typical rationing pattern)
- **Plan de ahorro**: government energy savings announcement
- **Maniobras correctivas**: official term for emergency grid stabilization

## Grid Geography (Priority Order — Cut First to Last)
1. Western states: Zulia, Tachira, Merida, Trujillo, Lara, Falcon — cut first, cut longest
2. Eastern states: Anzoategui, Monagas, Sucre — moderate risk
3. Central states: Carabobo, Aragua — moderate risk
4. Caracas (Distrito Capital) — almost never cut (political capital)
5. Bolivar state — near Guri dam, usually stable

## Generation Sources
- Guri Dam (Bolivar): ~70% of national generation. Vulnerable to dry season
  (March–May) and El Niño. Currently at 40% optimal capacity (May 2026).
- Thermoelectric plants: ~15% capacity due to fuel/parts shortages
- 60% of substations in critical condition

## Outage Types (Must Distinguish)
| Type               | Scope        | Onset    | Duration     |
|--------------------|--------------|----------|--------------|
| rationing          | 1-3 zones    | gradual  | 2-6h, predictable |
| feeder_fault       | 1 zone       | sudden   | 30min-24h    |
| substation_fault   | 3-10 zones   | sudden   | 2-12h        |
| transmission_fault | multi-region | sudden   | 1-8h         |
| national_blackout  | country-wide | instant  | 4-20h        |
| weather_damage     | 1-5 zones    | variable | 1-48h        |

## ISP / ASN Map (Venezuela)
- AS8048:   CANTV (state telecom, largest, most correlated with power outages)
- AS21826:  Inter
- AS264731: Movistar VE
- AS22313:  Digitel
Rule: ALL ISPs drop simultaneously = power outage. ONE drops = ISP issue.

## Known Rationing Patterns (Seed Data)
- Zulia: every other day (interdiario), 2-6h, usually after 1pm
- Tachira: daily, 3-4 blocks/day totaling 10-12h, starts ~10am
- Lara: 3-4x/week, 2-5h, after 2pm
- Merida: daily, 3-7h, starts ~noon
- Caracas: rarely cut

## Consequence Chain
Power out → water pumps fail → tanks deplete in 2-6h
Power out → CANTV drops within minutes
Power out → cell towers drain battery backup in ~4-8h
Power out → food safety window: 4h fridge, 24-48h freezer
            (shorter at Venezuelan temps of 30-35C+)

## CDN / R2
- **Phase 1**: Cloudflare R2 is single point of failure for status.json delivery.
  Accepted — system is in data-collection mode, no SLA promised.
- **Phase 2+**: add fallback upload to Supabase Storage if R2 upload fails.
  Frontend tries primary R2 URL first, falls back to secondary.
- **Upload**: boto3 S3-compatible. Bucket name "cocuyo" hardcoded (not sensitive).
  Endpoint: R2_ENDPOINT_URL (includes account ID).
  CacheControl: "max-age=60, s-maxage=300" set on put_object.
- **Env vars for R2**: R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
- Failure modes: expired credentials, Cloudflare account issues, network
  between runner and R2 endpoint. All caught by main.py exit code 1.

## Pipeline Monitoring
- **Phase 1**: minimal. status.json includes `"collector_errors": N` field.
  main.py exits non-zero only if R2 upload fails (total system failure).
  Individual collector failures logged but don't halt pipeline.
  GitHub Actions sends email on workflow failure by default.
- **Phase 2+**: health.json written to R2 every run (`{"ok": true, "timestamp": ...}`).
  External uptime monitor (UptimeRobot or similar) pings health.json,
  alerts if stale. Frontend shows "N of M data sources unavailable" if
  collector_errors > 0.

## Phase Config
- **COCUYO_PHASE**: env var (integer 1-5) read by pipeline and frontend.
  Determines runtime behavior for phase-dependent logic.
  Phase transitions are manual: change the env var when shipping next phase.
- **status.json** includes `"phase": 1` for frontend branching and debugging.
- Phase 1: unverified_reports only, fixed quorum, grey/blue map, 3 validation layers
- Phase 2: color-coded statuses, dynamic quorum, cross-validation, 5 validation layers
- Phase 3: satellite signals, OONI, zone mapping
- Phase 4: ML prediction, full classifier, device trust, 7 validation layers

## Scheduler
- **Phase 1**: GitHub Actions cron, expected 10-40min variance between runs.
  Acceptable for data-collection mode where real-time detection isn't promised.
- **Phase 2 prerequisite**: migrate to reliable scheduler (<2min variance)
  before passive signals go live. Options: $5/mo VPS or Cloudflare Worker.
- **Concurrency**: GitHub Actions workflow uses
  `concurrency: { group: "cocuyo-pipeline", cancel-in-progress: true }`.
  If a new run starts while previous is still going, cancel old one.
- **Idempotency**: pipeline carries zero in-memory state between runs.
  All state lives in Supabase tables (active_outages, outage_reports).
  Each run: read DB → compute → write status.json → upload.
  Safe to run multiple times or skip runs without corrupting state.

## Supabase Access Model
- **two-key model**: anon key for frontend INSERT only (RLS enforced),
  service_role key for pipeline SELECT only (server-side env var)
- **ip_hash**: computed by Supabase DB function on INSERT, never by client.
  Function extracts IP from request headers and hashes it.
- **anon INSERT columns**: region, lat, lon, status,
  onset_type, symptom, device_fingerprint, city_freetext
  (sub_zone, state, duration_min: not user-writable — see below)
- **state**: derived server-side from REGION_TO_STATE lookup in pipeline.
  Not user input. For "unlisted" reports, derived from GPS bounding box
  per state or left null if no GPS. Removed from anon-writable RLS list.
- **duration_min**: not collected from users. Column retained in schema
  but not user-writable. Duration computed by outage_lifecycle.py from
  event start/end timestamps, not from unreliable user estimates.
- **server-side only columns**: ip_hash, confirmed_by_passive, id, created_at

## Rationing Patterns (Static Reference Data)
- status.json includes `rationing_patterns` per region — known schedules
  from CONTEXT.md seed data. Gives Phase 1 a reason to visit even with
  zero crowd data. Reference data, not a detection claim.
- Display: "Historical pattern: Zulia typically sees outages every other
  day after 1pm" — users come for the schedule, stay to report.
- Patterns are static seed data, manually updated. Not computed from
  crowd reports until Phase 4 when enough history exists.
- Regions without known patterns show nothing (not "no rationing").

## Post-Submission Feedback
- After submitting report, frontend calls Supabase RPC function
  `get_recent_count(region, minutes)` → returns single integer.
- Displays: "Your report submitted. You + X others reported in the last 30 minutes."
- RPC function callable by anon role. No direct table SELECT access.
- **Rate-limited by design**: RPC only returns count if a report from the
  caller's IP exists in the last 60 seconds. Otherwise returns null.
  Prevents reconnaissance polling without contributing.
- Implementation: function checks EXISTS(report from current IP in last 60s)
  before running COUNT(*). Not a general-purpose query endpoint.

## Report Flow By Phase
- **Phase 1**: two taps only — region → status. Minimum friction.
  onset_type and symptom are null. Validate demand before adding questions.
- **Phase 2+**: four taps — region → status → onset_type → symptom.
  onset_type feeds simple classifier (T-021). symptom feeds full
  classifier (T-025B, Phase 4).
- **Power-back shortcut**: localStorage remembers last reported region +
  status. If last report was "no_power" within 12 hours, show prominent
  "Power back?" one-tap button at top of page (pre-filled region).
  Removes itself after submission. Reduces friction for the most
  valuable report type. localStorage is device-local, never sent to server.

## Sub-Zone
- **sub_zone**: null in Phase 1-2. Not collected from users.
  Zone_mapper (Phase 3) defines sub_zones from GPS clusters and
  backfills on future reports.
- Quorum min_zones check skipped when all sub_zones are null —
  null sub_zones must not block quorum.
- Avoids freetext normalization problem ("El Paraiso" vs "paraíso")
  and upfront neighborhood list maintenance.

## Region Assignment
- **region_assignment**: user-selected from 14 canonical cities.
  GPS collected post-selection for zone mapping only.
  Never used to override or validate user's region choice.
  Region "unlisted" reserved for users outside 14 cities —
  stored in Supabase, excluded from scoring until Phase 5 expansion.
- **canonical regions** (locked — 17 total): caracas, maracaibo, valencia,
  barquisimeto, maracay, ciudad_guayana, san_cristobal, merida,
  barinas, maturin, cumana, punto_fijo, los_teques, porlamar,
  barcelona, guarenas_guatire, valera
- **regions.py**: single source of truth for all region metadata.
  Exports REGIONS dict: region_key → {display_name, state, lat, lon}.
  Used by main.py, validation.py, and status.json generation.
  To add a region: add it here, nowhere else.
- **display_name**: stays in status.json (not a separate file). ~500 bytes
  overhead across 17 regions — not worth a second fetch/cache/failure mode.
- **"unlisted" reports**: stored but excluded from scoring. DO count
  toward get_recent_count RPC (unlisted users see solidarity with each
  other). Useful signal for expansion decisions.
- **expansion trigger**: when "unlisted" reports cluster around a GPS
  centroid with >50 reports, flag for manual review (Phase 5)
- **Supabase scaling**: free tier (500MB, 50K MAU) sufficient for Phase 1-2.
  ~2.5M report rows before storage matters. Upgrade trigger is MAU > 50K,
  not storage. Next tier: Supabase Pro ~$25/mo.

## Device Fingerprint
- **device_fingerprint**: collected and stored for future analysis only (Phase 1-3).
  Not used in validation, rate limiting, or trust scoring until Phase 4.
  Fingerprint stability on Venezuelan CANTV network is unproven.
  Hash of user-agent + screen + timezone — brittle across browser updates,
  trivially spoofable via DevTools.

## Cold Start
- **cold_start**: Phase 1 operates in data-collection mode only.
  Quorum fixed at 3 reports + 2 unique IPs for all regions.
  Status "unverified_reports" used until passive signals available in Phase 2.
  ESTIMATED_ACTIVE_USERS starts empty, populated by calibration.py in Phase 4.

## Signal Granularity
- **inet_score**: national signal only in Phase 1-2. Value = 1 minus
  the lowest normalized ASN score among all 4 Venezuelan ASNs.
  All regions receive identical inet_score until Phase 4, when
  historical patterns can weight regions by grid priority tier.
  Phase 2 sources: IODA + Cloudflare Radar only (no OONI).
- **sat_score**: per-region from Phase 3 onward (VIIRS 500m pixels)
- **crowd_score**: per-region from Phase 1 onward (GPS reports)
- **weather_score**: per-city from Phase 3 onward (NASA POWER lat/lon)
- **OONI**: deferred to Phase 3+. Censorship detection is a refinement,
  not required for power outage cross-validation. IODA + Cloudflare
  multi-ASN drop pattern is sufficient for Phase 2. OONI has hours
  of latency and sparse Venezuelan probe coverage.

## Outage Lifecycle
- **outage_reports**: individual user taps, raw crowd data (Phase 1+)
- **active_outages**: currently ongoing outage events, tracked by pipeline (Phase 2+)
- **outage_history**: completed outage events with type, duration, prediction
  accuracy. Written when restoration_tracker confirms power restored. (Phase 2+)
- **outage_lifecycle.py**: runs each pipeline cycle. Detects new outages from
  score transitions, tracks active events, writes completed events to
  outage_history on restoration. Bridge between raw reports and ML training data.
- **event_id**: UUID linking rows across regions for multi-region events.
  Simultaneous score transitions across regions share one event_id.
  Single-region outages get a unique event_id. Generated by outage_lifecycle.py.
  Present in both active_outages and outage_history.

## Outage Type Classification (Two Stages)
- **Phase 2 classifier** (spec Section 8.1): simple if/elif chain using
  inet_drop_national, inet_drop_regional, adjacent_regions_affected,
  crowd_reports_count. Produces: rationing, transmission_fault,
  national_blackout, unknown. Ships with Phase 2 passive signals.
- **Phase 4 classifier** (spec Section 7): full 18-field OutageSignature
  scoring system. Adds: feeder_fault, substation_fault, weather_damage.
  Requires zone mapper, symptom reporting, weather integration.
- One file: outage_type_classifier.py. One function: classify_outage_type.
  Phase 4 replaces Phase 2 implementation in place.

## Time Zones
- **Storage**: all timestamps UTC (TIMESTAMPTZ in Postgres, ISO 8601 in JSON)
- **Pipeline logic**: convert to VET (UTC-4) before any time-of-day or
  day-of-week comparisons. Constant: `VET_OFFSET = timedelta(hours=-4)`
  used project-wide. Venezuela has no daylight saving time.
- **Frontend display**: convert UTC to VET for all user-facing times.
- **Rationing pattern matching**: peak_start_hour values are in VET.
  1 PM VET = 17:00 UTC. Classifier must convert before comparing.
- **Critical**: get this wrong and every time-based pattern match
  silently fails by 4 hours.

## Pipeline Terminology
- **collector**: stateless function, pulls one external source, returns typed
  dict, never raises — returns {error: str} on failure
- **scorer**: combines collector outputs into 0–1 score per region
- **materialization**: when pipeline writes status.json to R2 CDN
- **passive signal**: satellite/internet data (VIIRS, IODA, Cloudflare, OONI)
- **active signal**: crowdsource report submitted by a user
- **quorum**: minimum weighted report count before crowd signal is trusted
- **device trust**: historical accuracy score per device fingerprint
- **zone**: learned feeder circuit boundary from GPS report clustering
- **bajón**: voltage sag — degraded state, not full outage
- **cross-validation**: reconciling crowd score against passive signals

## Status Values (Canonical — Never Change)
- "no_power"   — user reports power is out
- "power_back" — user reports power has returned
- "unstable"   — user reports voltage fluctuations (bajones)

## Region Status Values (Pipeline Output)
- "normal"              — score < 0.25, passive signals confirm (Phase 2+)
- "at_risk"             — score 0.25-0.45, passive signals confirm (Phase 2+)
- "likely_outage"       — score 0.45-0.70, passive signals confirm (Phase 2+)
- "confirmed_outage"    — score > 0.70, passive signals confirm (Phase 2+)
- "unverified_reports"  — crowd quorum met but no passive cross-validation (Phase 1)

## Prediction
- **prediction_score**: null until Phase 4 ships a trained model.
  No heuristic prediction in Phase 1-3. The spec's re-weighted
  current_score formula is not a prediction — it uses the same four
  signals with no time, history, or pattern features.
- **prediction_text**: null until Phase 4.
- Phase 4 model uses: time-of-day, day-of-week, season, historical
  rationing patterns, weather forecast, reservoir proxy — actual
  forward-looking features.

## Crowd Score
- **Pre-quorum**: score dampened by (total_weight / min_reports) * 0.5
- **Post-quorum**: crowd_score = outage_ratio (no_power_weight / total_weight)
  No diversity multiplier. Diversity already enforced by quorum gate
  (min reports, min zones, min unique IPs). Score reflects ground truth
  proportion directly.

## Scoring Normalization
- Score normalized by available signal weight, not total weight.
  Missing (None) signals excluded from both numerator and denominator.
- Formula: current_score = sum(weight_i * signal_i) / sum(weight_i)
  where i ranges over signals that are not None.
- Weights remain constant across phases:
  internet 0.35, crowdsource 0.30, satellite 0.20, weather 0.15
- A None signal is "absent" not "normal" — never treated as zero.
- If all signals None: status "no_data", score 0.0.

## Score Thresholds (Locked)
- < 0.25  → normal (green)
- 0.25–0.45 → at_risk (yellow)
- 0.45–0.70 → likely_outage (orange)
- > 0.70  → confirmed_outage (red)

## Frontend Performance Target
- **Total page weight**: 250KB gzipped max (not 100KB — unreachable with locked stack)
- **Initial paint**: <200KB — status list renders without map
- **Leaflet**: lazy-loaded as secondary chunk after initial paint
- **2G/3G goal**: region status visible within 2 seconds, map renders after
- Next.js + React + Leaflet framework floor is ~187KB gzipped before app code
- **PWA / offline**: hand-written sw.js in /public (no next-pwa dependency).
  Cache strategy: app shell cache-first, status.json network-first with
  cache fallback. If network fails, shows cached status.json with
  "Offline — showing last known data" banner. ~30 lines, zero abstractions.
  Directly serves core use case: user checks during outage with bad connectivity.
- **Cache-Control on R2**: `max-age=60, s-maxage=300`. Browser cache 60s
  (manual refresh feels fresh). CDN edge cache 5min (absorbs traffic spikes).
- **Auto-refresh**: Phase 1: every 10 minutes. Phase 2+: every 5 minutes.
  Uses next_update_approx from status.json to schedule next fetch.
  Manual pull-to-refresh fetches immediately regardless of interval.

## status.json Contract
- Full schema shipped from day one with null values for unavailable signals
- Phases fill in fields additively — schema structure never changes
- Frontend must handle null for any signal field (internet, satellite, weather)
- prediction_score is null until Phase 4
- status field values: "no_data" | "unverified_reports" (Phase 1),
  then "normal" | "at_risk" | "likely_outage" | "confirmed_outage" (Phase 2+)

## Data Flow (One Direction Only)
External APIs → collectors → scorer → status.json → CDN → frontend
User tap → Supabase outage_reports → pipeline reads on next cron

## What "Done" Means Per Phase
- Phase 1: status.json updates every 10min with crowd data only
- Phase 2: passive signals cross-validate crowd, ISP failure distinguished
           from power outage
- Phase 3: satellite data adds independent confirmation
- Phase 4: duration predictions + outage type classification live
- Phase 5: consequence layers — NOT in MVP