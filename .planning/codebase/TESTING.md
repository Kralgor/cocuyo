# Testing Patterns

**Analysis Date:** 2026-05-24

## Test Framework

**Runner:**
- pytest (version inferred from `.pytest_cache/v/cache` and `__pycache__/*.cpython-312-pytest-9.0.3.pyc`)
- No `pytest.ini`, `pyproject.toml`, or `setup.cfg` present — pytest runs with defaults
- Config: none (bare `pytest tests/` invocation)

**Assertion Library:**
- `pytest.approx` for all floating-point comparisons
- Standard `assert` for boolean and equality checks
- `unittest.mock.MagicMock` for all mocking

**Run Commands:**
```bash
pytest tests/                    # Run all tests
pytest tests/test_scorer.py      # Run single test file
pytest tests/ -k "TestCrowdOnly" # Run single class
pytest tests/ -v                 # Verbose output
```

**Coverage:** No coverage tool configured. No `.coveragerc`. No enforcement target.

**Frontend testing:** No test framework configured for TypeScript/React. No Jest, Vitest, or Playwright config detected. `package.json` has no `test` script. Frontend is untested.

## Test File Organization

**Location:** All tests live in `/tests/` directory — separate from `/pipeline/` source. One test file per pipeline module.

**Naming:** `test_<module_name>.py` mirroring the pipeline file: `tests/test_scorer.py` ↔ `pipeline/scorer.py`

**Structure:**
```
tests/
├── __init__.py
├── test_bajon_detector.py
├── test_calibration.py
├── test_collector_cloudflare.py
├── test_collector_internet.py
├── test_collector_viirs.py
├── test_collector_weather.py
├── test_cross_validation.py
├── test_duration_estimator.py
├── test_main_phase2.py
├── test_outage_classifier.py
├── test_outage_classifier_full.py
├── test_outage_lifecycle.py
├── test_pipeline_integration.py
├── test_quorum.py
├── test_restoration_tracker.py
├── test_scorer.py
├── test_train_duration_model.py
├── test_unified.py
├── test_validation.py
├── test_water_predictor.py
└── test_zone_mapper.py
```

**Scale:** 22 test files, ~4,063 lines total. Approximately 540+ individual test functions across all files.

## Test Structure

**Suite Organization:**
Tests group by behavior/scenario using classes, not by method:
```python
class TestCrowdOnly:
    def test_crowd_present_no_passives_returns_unverified_reports(self):
        result = compute_region_score(crowd_score=0.5)
        assert result.status == "unverified_reports"

    def test_crowd_zero_no_passives_is_unverified_not_no_data(self):
        result = compute_region_score(crowd_score=0.0)
        assert result.status == "unverified_reports"
        assert result.current_score == pytest.approx(0.0)
```

**Class naming:** `TestXxx` where `Xxx` describes the scenario or path — `TestCrowdOnly`, `TestNoneExclusion`, `TestTwoSignals`, `TestFourSignals`, `TestThresholds`, `TestOutputFields`.

**Method naming:** `test_<what>_<condition>_<expected_result>` — `test_at_soft_limit_flagged`, `test_score_below_025_is_normal`, `test_timeout_returns_empty`.

**Patterns:**
- Arrange-Act-Assert in single test body — no setup/teardown in the vast majority of tests
- One logical assertion per test where possible; multiple related assertions grouped when testing a single return shape
- Inline comments document the math: `# score = (0.35*0.50) / 0.35 = 0.50 (not 0.175 if others treated as 0)`
- Tests pin exact numeric values with the calculation shown

**Fixed timestamps:** `NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)` — module-level constant in every test file that needs time.

## Mocking

**Framework:** `unittest.mock.MagicMock` — no pytest-mock. Always from standard library.

**Session injection pattern** (used by all HTTP collectors):
Collectors accept `_session: requests.Session | None = None` as a parameter. Tests inject a mock session directly — no monkey-patching required:
```python
def _mock_resp(data: dict, status: int = 200) -> MagicMock:
    r = MagicMock()
    r.status_code = status
    r.json.return_value = data
    r.raise_for_status.side_effect = (
        None if status < 400 else Exception(f"HTTP {status}")
    )
    return r

def _session(resp) -> MagicMock:
    s = MagicMock()
    if isinstance(resp, Exception):
        s.get.side_effect = resp
    else:
        s.get.return_value = resp
    return s

# Usage:
result = fetch_traffic_timeseries_by_asn("8048", _session=_session(_mock_resp(payload)))
```

**Supabase client mock pattern** (used by DB-touching modules):
Chain-mocked using `.return_value` chaining to match fluent query builder API:
```python
def _mock_client(updated_count: int = 3) -> MagicMock:
    client = MagicMock()
    chain  = client.table.return_value
    chain  = chain.update.return_value
    chain  = chain.eq.return_value
    chain  = chain.eq.return_value
    chain  = chain.gte.return_value
    chain.execute.return_value = MagicMock(data=[{}] * updated_count)
    return client
```

**Error simulation:** `s.get.side_effect = Exception("timeout")` for network errors; `client.table.side_effect = Exception("DB error")` for DB errors.

**What to Mock:**
- External HTTP calls: always via injected `_session`
- Supabase client: always via constructor injection — never patch at module level
- `now` datetime: always passed as parameter, never mocked via `patch`

**What NOT to Mock:**
- Pure computation functions (`compute_region_score`, `cross_validate`, `detect_outage_from_timeseries`) — tested with real values
- Dataclasses and TypedDicts — instantiated directly
- Internal helper functions — accessed via module import when testing internal helpers directly (e.g. `_close_outage`, `_create_active_outage`, `_fetch_active_outages`)

## Fixtures and Factories

**No pytest fixtures** (`@pytest.fixture`) — not used. Instead, module-level helper factory functions are used:

```python
# test_validation.py
def make_report(
    ip_hash: str = "hash_a",
    status: str = "no_power",
    region: str = "maracaibo",
    lat: float | None = 10.6427,
    lon: float | None = -71.6125,
    device_fingerprint: str | None = None,
) -> dict:
    return {
        "ip_hash": ip_hash,
        "status": status,
        "region": region,
        "lat": lat,
        "lon": lon,
        "created_at": NOW,
        "device_fingerprint": device_fingerprint,
    }

def past_reports(
    n: int = 1,
    ip_hash: str = "hash_a",
    status: str = "no_power",
    region: str = "maracaibo",
    minutes_ago: int = 5,
) -> list[dict]:
    ...

def regional_reports(n: int, status: str, minutes_ago: int = 5) -> list[dict]:
    """n reports from n different IPs — simulates regional consensus."""
    ...
```

```python
# test_quorum.py
def r(status="no_power", weight=1.0, ip_hash="hash_a", sub_zone=None):
    return {"status": status, "weight": weight, "ip_hash": ip_hash, "sub_zone": sub_zone}
```

**Location:** Factory functions live at the module level inside each test file. No shared fixtures directory or conftest.py.

**Test data approach:** Synthetic in-memory data only. No fixture files. No JSON test data files. Real Venezuelan coordinates used (`lat=10.6427, lon=-71.6125` is Maracaibo) for realism.

## Coverage

**Requirements:** None enforced. No coverage tool configured.

**View Coverage:**
```bash
# Not currently configured. To add:
pip install pytest-cov
pytest tests/ --cov=pipeline --cov-report=term-missing
```

## Test Types

**Unit Tests:**
Pure function tests with no I/O. The majority of the test suite. Tests a single function or class in isolation: `compute_region_score`, `compute_quorum`, `compute_crowd_score`, `validate`, `detect_outage_from_timeseries`, `cross_validate`, `classify_ratio`. Located in their respective `test_<module>.py` files.

**Integration Tests:**
`tests/test_pipeline_integration.py` — feeds synthetic reports through the full pipeline chain (`validation → quorum → scorer → status.json shape`) using `pipeline.main.score_region()` and `build_status_json()` directly. No external dependencies. Tests status.json output shape, all 17 regions, and pipeline behavior under different report configurations.

**E2E Tests:** Not used. No browser automation, no Playwright, no Cypress.

**Mock-data offline tests:** All collector tests run offline. This is the project's stated rule ("Every collector function must have a mock-data test that runs offline" per CLAUDE.md). Enforced consistently across `test_collector_cloudflare.py`, `test_collector_internet.py`, `test_collector_viirs.py`, `test_collector_weather.py`.

## Common Patterns

**Floating-point comparison:**
```python
assert result.current_score == pytest.approx(0.675, abs=1e-6)
assert result.weight == pytest.approx(0.7)
assert score == pytest.approx(1.0 / MIN_REPORTS * 0.5, abs=1e-6)
```

**Status string comparison:**
```python
assert result.status == "no_data"
assert result.status == "unverified_reports"
assert result.status == "confirmed_outage"
```

**Boolean and None checks:**
```python
assert result.accepted is True
assert result.accepted is False
assert result.prediction_score is None
assert "flag" not in r
assert "error" in result
```

**Boundary conditions — always explicit:**
Tests always include exact threshold values. From `test_scorer.py`:
```python
def test_score_at_070_is_likely_outage(self):
    # 0.70 is NOT above 0.70 → likely_outage, not confirmed
    result = compute_region_score(crowd_score=None, internet_score=0.70)
    assert result.status == "likely_outage"

def test_score_above_070_is_confirmed_outage(self):
    result = compute_region_score(crowd_score=None, internet_score=0.80)
    assert result.status == "confirmed_outage"
```

**Error path testing:**
```python
def test_timeout_returns_empty(self):
    result = fetch_traffic_timeseries_by_asn("8048", _session=_session(Exception("timeout")))
    assert result["values"] == []
    assert result["timestamps"] == []
    assert "error" in result

def test_supabase_error_returns_zero(self):
    client = MagicMock()
    client.table.side_effect = Exception("DB error")
    count = backfill_confirmed_by_passive("maracaibo", client, now=NOW)
    assert count == 0
```

**ADR-deferred behavior testing:**
Features deferred to future phases are tested to confirm they do NOT yet have effect:
```python
class TestDeviceFingerprint:
    def test_fingerprint_present_does_not_cause_rejection(self):
        report = make_report(device_fingerprint="fp_abc123")
        result = validator.validate(report, [], now=NOW)
        assert result.accepted is True  # deferred to Phase 4 per ADR-005
```

## Required Test Coverage (per CLAUDE.md)

These modules **must** have unit tests before implementation is considered done:
- `pipeline/validation.py` → `tests/test_validation.py` (present, 237 lines)
- `pipeline/quorum.py` → `tests/test_quorum.py` (present)
- `pipeline/scorer.py` → `tests/test_scorer.py` (present, 197 lines)
- `pipeline/cross_validation.py` → `tests/test_cross_validation.py` (present)
- `pipeline/collector_cloudflare.py` → `tests/test_collector_cloudflare.py` (present, 206 lines)

All five required modules have corresponding test files.

---

*Testing analysis: 2026-05-24*
