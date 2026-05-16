"""
Tests for pipeline/collector_viirs.py. All offline.
"""
import pytest
from unittest.mock import MagicMock

from pipeline.collector_viirs import (
    BASELINE_RADIANCE,
    _STATUS_TO_SCORE,
    classify_ratio,
    fetch_latest_viirs,
)

# ── classify_ratio ────────────────────────────────────────────────────────────

class TestClassifyRatio:
    def test_zero_is_major_outage(self):
        assert classify_ratio(0.0) == "major_outage"

    def test_below_0_3_is_major_outage(self):
        assert classify_ratio(0.29) == "major_outage"

    def test_exactly_0_3_is_partial_outage(self):
        assert classify_ratio(0.3) == "partial_outage"

    def test_between_0_3_and_0_6_is_partial_outage(self):
        assert classify_ratio(0.45) == "partial_outage"

    def test_below_0_6_is_partial_outage(self):
        assert classify_ratio(0.59) == "partial_outage"

    def test_exactly_0_6_is_degraded(self):
        assert classify_ratio(0.6) == "degraded"

    def test_between_0_6_and_0_85_is_degraded(self):
        assert classify_ratio(0.72) == "degraded"

    def test_below_0_85_is_degraded(self):
        assert classify_ratio(0.84) == "degraded"

    def test_exactly_0_85_is_normal(self):
        assert classify_ratio(0.85) == "normal"

    def test_1_0_is_normal(self):
        assert classify_ratio(1.0) == "normal"

    def test_above_1_0_is_normal(self):
        assert classify_ratio(1.5) == "normal"


# ── fetch_latest_viirs — missing granules ─────────────────────────────────────

class TestMissingGranules:
    def _empty_session(self):
        resp = MagicMock()
        resp.raise_for_status.side_effect = None
        resp.json.return_value = {"feed": {"entry": []}}
        s = MagicMock()
        s.get.return_value = resp
        return s

    def _error_session(self):
        s = MagicMock()
        s.get.side_effect = Exception("CMR timeout")
        return s

    def test_no_granules_returns_empty_dict(self):
        result = fetch_latest_viirs(_session=self._empty_session())
        assert result == {}

    def test_cmr_error_returns_empty_dict(self):
        result = fetch_latest_viirs(_session=self._error_session())
        assert result == {}

    def test_http_error_returns_empty_dict(self):
        resp = MagicMock()
        resp.raise_for_status.side_effect = Exception("HTTP 503")
        s = MagicMock()
        s.get.return_value = resp
        result = fetch_latest_viirs(_session=s)
        assert result == {}


# ── fetch_latest_viirs — with granules ────────────────────────────────────────

class TestWithGranules:
    def _session_with_granules(self, n=2):
        resp = MagicMock()
        resp.raise_for_status.side_effect = None
        resp.json.return_value = {"feed": {"entry": [{"id": f"g{i}"} for i in range(n)]}}
        s = MagicMock()
        s.get.return_value = resp
        return s

    def test_extract_none_produces_empty_result(self):
        # _extract_fn always returns None -> no regions in result
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: None,
        )
        assert result == {}

    def test_extract_value_populates_region(self):
        baseline = BASELINE_RADIANCE["caracas"]  # 45.2
        observed = baseline * 0.9               # ratio=0.9 -> normal
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "caracas" else None,
        )
        assert "caracas" in result
        assert result["caracas"]["status"] == "normal"

    def test_result_contains_required_keys(self):
        baseline = BASELINE_RADIANCE["maracaibo"]
        observed = baseline * 0.2  # major_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "maracaibo" else None,
        )
        entry = result["maracaibo"]
        assert "observed" in entry
        assert "baseline" in entry
        assert "ratio" in entry
        assert "status" in entry
        assert "score" in entry

    def test_major_outage_ratio_and_score(self):
        baseline = BASELINE_RADIANCE["valencia"]
        observed = baseline * 0.2   # ratio=0.2 -> major_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "valencia" else None,
        )
        assert result["valencia"]["status"] == "major_outage"
        assert result["valencia"]["score"] == pytest.approx(0.90)
        assert result["valencia"]["ratio"] == pytest.approx(0.2, abs=0.001)

    def test_partial_outage_score(self):
        baseline = BASELINE_RADIANCE["barquisimeto"]
        observed = baseline * 0.45  # ratio=0.45 -> partial_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "barquisimeto" else None,
        )
        assert result["barquisimeto"]["status"] == "partial_outage"
        assert result["barquisimeto"]["score"] == pytest.approx(0.60)

    def test_degraded_score(self):
        baseline = BASELINE_RADIANCE["maracay"]
        observed = baseline * 0.72  # degraded
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "maracay" else None,
        )
        assert result["maracay"]["status"] == "degraded"
        assert result["maracay"]["score"] == pytest.approx(0.30)

    def test_baseline_stored_in_result(self):
        baseline = BASELINE_RADIANCE["caracas"]
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: baseline if r == "caracas" else None,
        )
        assert result["caracas"]["baseline"] == baseline

    def test_all_17_regions_have_baselines(self):
        from pipeline.regions import REGIONS
        assert set(BASELINE_RADIANCE.keys()) == set(REGIONS.keys())

    def test_date_str_sent_to_cmr(self):
        s = self._session_with_granules()
        fetch_latest_viirs(
            date_str="2026-05-15",
            _session=s,
            _extract_fn=lambda g, r: None,
        )
        call_params = s.get.call_args.kwargs.get("params") or s.get.call_args[1].get("params", {})
        assert "2026-05-15" in call_params.get("temporal", "")
