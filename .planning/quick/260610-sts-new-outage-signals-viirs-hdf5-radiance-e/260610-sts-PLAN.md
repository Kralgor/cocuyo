---
phase: quick-260610-sts
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - requirements.txt
  - pipeline/collector_viirs.py
  - pipeline/collector_ripe.py
  - pipeline/collector_mlab.py
  - pipeline/collector_internet_unified.py
  - tests/test_collector_viirs.py
  - tests/test_collector_ripe.py
  - tests/test_collector_mlab.py
  - tests/test_unified.py
autonomous: true
requirements: [QUICK-260610-STS]

must_haves:
  truths:
    - "VIIRS collector extracts mean radiance per region from a VNP46A2NRT HDF5 granule and returns None for cloud-heavy regions"
    - "VIIRS download only attempts inside the publication window (06:00-08:00 UTC); other cycles return {} without HDF5 download"
    - "RIPE Atlas collector returns per-region disconnected-probe ratio + weak corroborating score, {} on error"
    - "M-Lab collector returns {} via documented stub (endpoint unverified) and logs a warning"
    - "RIPE/M-Lab corroboration adjusts internet_score by a capped delta without changing scorer.py weights"
    - "All new pure functions have offline mock-data tests; no network in tests; pytest passes"
  artifacts:
    - path: "pipeline/collector_viirs.py"
      provides: "Real _extract_region_radiance HDF5 impl + pure pixel/QF helpers + publication-window guard"
      contains: "DNB_BRDF-Corrected_NTL"
    - path: "pipeline/collector_ripe.py"
      provides: "RIPE Atlas probe connectivity collector"
      contains: "def fetch_ripe_connectivity"
    - path: "pipeline/collector_mlab.py"
      provides: "M-Lab NDT collector (documented stub)"
      contains: "def fetch_mlab_signals"
    - path: "pipeline/collector_internet_unified.py"
      provides: "RIPE/M-Lab blended into internet_score with capped delta"
      contains: "apply_corroboration"
    - path: "tests/test_collector_ripe.py"
      provides: "Offline mock tests for RIPE collector"
      contains: "def test_"
    - path: "tests/test_collector_mlab.py"
      provides: "Offline tests for M-Lab stub"
      contains: "def test_"
  key_links:
    - from: "pipeline/main.py::_fetch_passive_signals"
      to: "pipeline/collector_viirs.py::fetch_latest_viirs"
      via: "existing call — unchanged signature"
      pattern: "fetch_latest_viirs"
    - from: "pipeline/collector_internet_unified.py::collect_all_internet_signals"
      to: "fetch_ripe_connectivity + fetch_mlab_signals"
      via: "additional collector calls + apply_corroboration on internet_score"
      pattern: "apply_corroboration"
---

<objective>
Add three new outage signals to the Cocuyo pipeline:
1. Complete the VIIRS HDF5 radiance extraction stub (real h5py impl).
2. Add a RIPE Atlas probe-connectivity collector.
3. Add an M-Lab NDT collector (documented stub — endpoint unverified).
4. Blend RIPE/M-Lab as internet-class corroboration into `internet_score` without touching scorer weights.

Purpose: Strengthen multi-signal outage detection — satellite (covers zero-user areas) + two independent internet-class corroboration sources.
Output: Completed `collector_viirs.py`, new `collector_ripe.py` + `collector_mlab.py`, integration in `collector_internet_unified.py`, `h5py` in requirements, full offline test coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Pattern references (stateless collector, typed returns, try/except, offline-testable)
@pipeline/collector_cloudflare.py
@pipeline/collector_viirs.py
@pipeline/collector_internet_unified.py
@pipeline/regions.py
@pipeline/main.py
@tests/test_collector_viirs.py

<interfaces>
<!-- Contracts the executor must honor. Do NOT change scorer.py weights (ADR-009: internet .35, crowd .30, satellite .20, weather .15). -->

Region coords (pipeline/regions.py):
  REGIONS[key] = {"display_name", "state", "lat": float, "lon": float}
  17 canonical keys. Build region bbox as coord ± ~0.15°.

VIIRS existing public surface (pipeline/collector_viirs.py) — KEEP signatures stable so existing tests pass:
  fetch_latest_viirs(date_str=None, _session=None, _extract_fn=_extract_region_radiance) -> dict[str, dict]
  _extract_region_radiance(granules: list[dict], region: str) -> float | None   # currently returns None — implement
  classify_ratio(ratio: float) -> str
  BASELINE_RADIANCE: dict[str, float]  (all 17 regions)
  _STATUS_TO_SCORE, VE_BBOX, CMR_URL, TIMEOUT_S

Internet collector (pipeline/collector_internet_unified.py):
  classify_internet_situation(ioda, cloudflare, ooni) -> dict  (has "internet_score": float 0-1)
  collect_all_internet_signals(now=None, _ioda_session=None, _cf_session=None) -> dict
    returns {"timestamp","ioda","cloudflare","ooni","classification"}
  main.py reads: result["classification"].get("internet_score")
</interfaces>

<viirs_grid_facts>
<!-- VNP46A2NRT grid facts from approved decision #2. Code comment must note "verify QF convention". -->
- Product short_name "VNP46A2NRT" (already queried in _fetch_granule_list).
- Granules are gridded 10°×10° linear-lat tiles, 2400×2400 px (15 arcsec/px).
- Venezuela tiles: h10v07, h11v07 (lon -80..-60, lat 0..10); h10v06, h11v06 (lat 10..20 portion).
- Download via the granule `links` URLs in CMR response, NASA_TOKEN bearer auth (LAADS/Earthdata).
- Dataset: HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/DNB_BRDF-Corrected_NTL
    scale factor 0.1, fill value 65535.
- Quality: HDFEOS/.../Data Fields/Mandatory_Quality_Flag — keep 0=high, 1=ok; drop 2=poor/cloud.
    Be conservative; add comment "verify exact QF convention".
- Tile pixel index: linear lat/lon within the tile's 10° span over 2400 px.
- Cloud-heavy night -> few valid pixels -> return None for that region (absent != zero, ADR-009).
</viirs_grid_facts>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Complete VIIRS HDF5 radiance extraction + publication-window guard</name>
  <files>requirements.txt, pipeline/collector_viirs.py, tests/test_collector_viirs.py</files>
  <behavior>
    Pure helpers (test with synthetic numpy arrays — NO network, NO real HDF5):
    - lonlat_to_tile_pixel(lat, lon, tile_h, tile_v) -> (row, col) | None : returns None when coord outside tile span; correct linear index for an in-tile coord.
    - mask_valid_radiance(ntl: np.ndarray, qf: np.ndarray) -> np.ndarray : applies scale 0.1, drops fill 65535, drops QF==2 (keeps 0,1); returns 1-D array of valid scaled radiances.
    - mean_region_radiance(ntl, qf, rows, cols) -> float | None : mean of valid pixels over a region pixel window; returns None when zero valid pixels (cloud-heavy).
    - which_tiles(lat, lon) -> list[str] : returns tile id(s) e.g. "h10v07" for a VE coord.
    - in_publication_window(now_utc) -> bool : True only for 06:00-08:00 UTC.
    Integration behavior (mock-tested):
    - fetch_latest_viirs outside the window returns {} and does NOT call download.
    - Existing tests in test_collector_viirs.py still pass unchanged (do not break fetch_latest_viirs / _extract_region_radiance / classify_ratio signatures).
  </behavior>
  <action>
    Add `h5py==3.12.1` to requirements.txt (ONLY new dep — approved decision #1). Do not add rasterio; update the stub comment that referenced rasterio.

    In pipeline/collector_viirs.py implement the real HDF5 path per <viirs_grid_facts>:
    - Add pure functions lonlat_to_tile_pixel, mask_valid_radiance, mean_region_radiance, which_tiles, in_publication_window (all type-hinted, no network, no I/O). These are the unit-tested core.
    - Add a download helper _download_granule(link_url, session) -> str (tempfile path) using NASA_TOKEN bearer auth; try/except, returns None on failure; caller deletes tempfile in a finally block.
    - Add _read_granule_radiance(path) -> tuple[np.ndarray, np.ndarray] reading datasets DNB_BRDF-Corrected_NTL and Mandatory_Quality_Flag via h5py (lazy `import h5py` inside the function so tests not exercising download stay import-light); comment "verify exact QF convention (drop 2=cloud/poor)".
    - Implement _extract_region_radiance(granules, region): map region coord (pipeline/regions.py REGIONS[region], ± ~0.15° box) -> tile + pixel window via which_tiles + lonlat_to_tile_pixel; select matching granule from `granules` by tile id in its `links`/title; download, read, mask, mean_region_radiance; delete tempfile; return float or None. Keep signature `(granules: list[dict], region: str) -> float | None` so existing _extract_fn injection tests pass.
    - Add the publication-window guard at the TOP of fetch_latest_viirs: accept optional `now=None` (default datetime.now(timezone.utc)); if not in_publication_window(now): log info "VIIRS: outside publication window — skipping download" and return {} BEFORE _fetch_granule_list. Keep all other existing fetch_latest_viirs behavior. Comment the daily-product / heavy-download tradeoff (approved decision #7).
    - Stateless: no module-level mutable cache. Logging module only, no f-strings in log calls, no print.

    Add tests to tests/test_collector_viirs.py (new test classes, keep existing ones):
    - TestPixelMath: lonlat_to_tile_pixel in-tile correctness + out-of-tile None.
    - TestRadianceMasking: synthetic numpy arrays — fill 65535 dropped, QF==2 dropped, scale 0.1 applied, all-cloud -> mean_region_radiance None.
    - TestWhichTiles: a Caracas/Maracaibo coord maps to expected tile id.
    - TestPublicationWindow: in_publication_window True at 07:00 UTC, False at 14:00 UTC; fetch_latest_viirs(now=<14:00 UTC>) returns {} and _session.get NOT called.
    Construct synthetic arrays with numpy directly — no real HDF5, no network.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/Leo/claude/cocuyo && python -m pytest tests/test_collector_viirs.py -x -q</automated>
  </verify>
  <done>h5py pinned in requirements.txt; pure pixel/QF/window helpers implemented + unit-tested with synthetic numpy arrays; _extract_region_radiance reads real granule via h5py; fetch_latest_viirs skips download outside 06:00-08:00 UTC; all existing VIIRS tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RIPE Atlas collector + M-Lab NDT collector (documented stub) + tests</name>
  <files>pipeline/collector_ripe.py, pipeline/collector_mlab.py, tests/test_collector_ripe.py, tests/test_collector_mlab.py</files>
  <behavior>
    RIPE (pure + mock-tested, NO network):
    - nearest_region(lat, lon, threshold=0.5) -> str | None : maps probe coord to nearest REGIONS key within ~0.5°, else None.
    - score_region_probes(disconnected, total) -> float : 0.0 unless total >= 2 AND disconnected/total elevated; bounded 0..1.
    - fetch_ripe_connectivity(_session=None) -> dict : parses probes list into {region: {"disconnected_ratio", "probe_count", "score"}}; status 1=connected, 2=disconnected; {} on error (never raises).
    M-Lab:
    - fetch_mlab_signals(_session=None) -> dict : documented stub returning {} + logger.warning, endpoint marked "verify endpoint". Does NOT invent a live endpoint as fact.
  </behavior>
  <action>
    Create pipeline/collector_ripe.py following the collector_cloudflare.py pattern (stateless, requests-based, TIMEOUT_S, try/except, returns {} on error, never raises — approved decision #4):
    - Constants: RIPE_API = "https://atlas.ripe.net/api/v2", TIMEOUT_S = 15.
    - Pure helpers nearest_region(lat, lon, threshold=0.5) and score_region_probes(disconnected, total) (type-hinted, no I/O). nearest_region iterates REGIONS computing simple degree distance; returns key within threshold else None. score_region_probes returns 0.0 when total < 2; otherwise scales disconnected/total into 0..1 as a WEAK corroborating signal (e.g. 0 below a low ratio, ramping toward ~0.6 max — keep it weak; comment the cap).
    - fetch_ripe_connectivity(_session=None): GET {RIPE_API}/probes/?country_code=VE&status=1 ... but to capture disconnected probes query without status filter and read each probe's `status`/`status_since`, `latitude`, `longitude`, `asn_v4`; group by nearest_region; compute disconnected/total per region; build {region: {"disconnected_ratio": float, "probe_count": int, "score": float}}; skip probes with no region match. try/except -> log warning, return {}. Use logging module, no f-strings in logs.
    - Handle RIPE pagination minimally (single page is fine for <20 VE probes; note `results` key).

    Create pipeline/collector_mlab.py (approved decision #3 — endpoint NOT confidently known):
    - fetch_mlab_signals(_session=None) -> dict: documented STUB. Module docstring + inline comment "verify endpoint" referencing https://statistics.measurementlab.net/v0/ as a CANDIDATE (not asserted as working). Return {} and logger.warning("M-Lab collector stub: endpoint unverified — returning no signal"). Do NOT call any URL presented as fact. Keep the same stateless/try-except shape so wiring it later is trivial.

    Tests (offline, mock-data):
    - tests/test_collector_ripe.py: nearest_region maps a near-Caracas coord to "caracas" and a mid-ocean coord to None; score_region_probes returns 0.0 for total<2 and >0 for elevated ratio with total>=2; fetch_ripe_connectivity with a MagicMock session returning a synthetic probes payload produces expected per-region dict; error session -> {}.
    - tests/test_collector_mlab.py: fetch_mlab_signals returns {} (stub) and does not raise; (optional) assert warning logged via caplog.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/Leo/claude/cocuyo && python -m pytest tests/test_collector_ripe.py tests/test_collector_mlab.py -x -q</automated>
  </verify>
  <done>collector_ripe.py returns per-region disconnected-ratio/probe_count/weak score and {} on error; collector_mlab.py is a documented stub returning {} with a warning and "verify endpoint" comment; both have offline mock tests that pass; no network in tests; no invented endpoints asserted as fact.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Blend RIPE/M-Lab corroboration into internet_score (no scorer weight change)</name>
  <files>pipeline/collector_internet_unified.py, tests/test_unified.py</files>
  <behavior>
    apply_corroboration(base_score, ripe, mlab, cap=0.15) -> float (pure, mock-tested):
    - base_score unchanged when ripe/mlab empty.
    - RIPE elevated disconnect signal adds at most +cap; result clamped to [0,1].
    - M-Lab stub ({}) contributes 0.
    - Never lowers a strong base_score below itself by more than cap; never produces <0 or >1.
    collect_all_internet_signals still returns the same dict shape with classification["internet_score"] adjusted, and includes "ripe" and "mlab" keys for transparency.
  </behavior>
  <action>
    In pipeline/collector_internet_unified.py (approved decisions #5 — do NOT touch scorer.py weights; cap RIPE contribution ~±0.15):
    - Add pure function apply_corroboration(base_score: float, ripe: dict, mlab: dict, cap: float = 0.15) -> float. Compute a corroboration delta from RIPE per-region scores (e.g. max region score across VE, or a simple aggregate) scaled into [0, cap]; M-Lab contributes 0 while stubbed. Add to base_score, clamp to [0.0, 1.0]. Comment that this keeps ADR-009 scorer weights untouched (it only refines the internet_score input, not the blend weights).
    - In collect_all_internet_signals: import fetch_ripe_connectivity (pipeline.collector_ripe) and fetch_mlab_signals (pipeline.collector_mlab) lazily inside the function. After classify_internet_situation, call ripe = fetch_ripe_connectivity() and mlab = fetch_mlab_signals(); each wrapped so a failure -> empty dict and a logged warning (never abort). Set classification["internet_score"] = apply_corroboration(classification["internet_score"], ripe, mlab). Add "ripe": ripe and "mlab": mlab to the returned dict. Keep all existing keys/shape so main.py and existing tests still read result["classification"]["internet_score"].
    - Logging module, no f-strings in logs, stateless.

    Tests in tests/test_unified.py (add cases; keep existing passing):
    - apply_corroboration: empty ripe/mlab -> base unchanged; elevated RIPE -> +delta capped at cap and clamped <=1.0; base 0.95 + cap stays <=1.0; never <0.
    - collect_all_internet_signals: with mocked ripe returning empty and mlab empty, internet_score equals classifier output (no change) — assert backward compatibility.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/Leo/claude/cocuyo && python -m pytest tests/test_unified.py tests/test_main_phase2.py -x -q</automated>
  </verify>
  <done>apply_corroboration blends RIPE/M-Lab into internet_score with a capped, clamped delta; scorer.py weights untouched; collect_all_internet_signals returns ripe/mlab transparency keys with unchanged shape; existing unified + phase2 main tests pass.</done>
</task>

</tasks>

<verification>
- Full collector test suite passes: `python -m pytest tests/test_collector_viirs.py tests/test_collector_ripe.py tests/test_collector_mlab.py tests/test_unified.py tests/test_main_phase2.py -q`
- requirements.txt diff adds ONLY `h5py==3.12.1` (no rasterio, no bigquery, no other dep).
- No network calls in any test (all sessions mocked; numpy arrays synthetic).
- `git grep -n "print(" pipeline/collector_ripe.py pipeline/collector_mlab.py pipeline/collector_viirs.py` returns nothing (logging only).
- scorer.py unchanged: `git diff --stat pipeline/scorer.py` is empty.
- app/ untouched: `git diff --stat app/` is empty.
</verification>

<success_criteria>
- VIIRS extracts real per-region radiance from VNP46A2NRT HDF5, returns None for cloud-heavy regions, only downloads in 06:00-08:00 UTC window.
- RIPE collector produces weak per-region corroboration; M-Lab is a documented, clearly-labeled stub.
- internet_score refined by capped RIPE/M-Lab corroboration without changing ADR-009 scorer weights.
- All new logic has offline mock-data tests; entire suite green.
- Frontend, scorer weights, and database schema untouched.
</success_criteria>

<output>
Create `.planning/quick/260610-sts-new-outage-signals-viirs-hdf5-radiance-e/260610-sts-SUMMARY.md` when done.
Commit messages reference spec section 5.2 for VIIRS work (e.g. "feat: collector_viirs HDF5 extraction (spec section 5.2)").
</output>
