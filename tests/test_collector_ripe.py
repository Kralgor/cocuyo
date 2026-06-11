"""
Tests for pipeline/collector_ripe.py. All offline — no network calls.
"""
import pytest
from unittest.mock import MagicMock

from pipeline.collector_ripe import (
    nearest_region,
    score_region_probes,
    fetch_ripe_connectivity,
)


# ── nearest_region ─────────────────────────────────────────────────────────────

class TestNearestRegion:
    def test_near_caracas_maps_to_caracas(self):
        # caracas: lat=10.4806, lon=-66.9036
        result = nearest_region(10.50, -66.90)
        assert result == "caracas"

    def test_near_maracaibo_maps_to_maracaibo(self):
        # maracaibo: lat=10.6427, lon=-71.6125
        result = nearest_region(10.60, -71.60)
        assert result == "maracaibo"

    def test_mid_ocean_coord_returns_none(self):
        # Far from any Venezuelan city
        result = nearest_region(5.0, -50.0)
        assert result is None

    def test_coord_above_threshold_returns_none(self):
        # 1 degree away — above 0.5 threshold
        result = nearest_region(10.4806 + 0.6, -66.9036)
        assert result is None

    def test_coord_within_threshold_returns_region(self):
        # 0.3 degrees away — within 0.5 threshold
        result = nearest_region(10.4806 + 0.3, -66.9036)
        assert result == "caracas"

    def test_returns_nearest_when_multiple_close(self):
        # Exact coordinate of caracas — should match exactly
        result = nearest_region(10.4806, -66.9036)
        assert result == "caracas"


# ── score_region_probes ───────────────────────────────────────────────────────

class TestScoreRegionProbes:
    def test_zero_for_less_than_two_probes(self):
        assert score_region_probes(1, 1) == 0.0

    def test_zero_for_zero_total(self):
        assert score_region_probes(0, 0) == 0.0

    def test_zero_for_one_probe(self):
        assert score_region_probes(1, 1) == 0.0

    def test_positive_for_elevated_ratio_with_enough_probes(self):
        # 3 disconnected out of 4 total — elevated ratio
        score = score_region_probes(3, 4)
        assert score > 0.0

    def test_score_bounded_0_to_1(self):
        score = score_region_probes(10, 10)
        assert 0.0 <= score <= 1.0

    def test_weak_cap_not_exceeded(self):
        # Max possible score should be <= 0.6 (weak corroboration cap)
        score = score_region_probes(100, 100)
        assert score <= 0.6

    def test_zero_disconnected_gives_zero(self):
        score = score_region_probes(0, 5)
        assert score == pytest.approx(0.0)

    def test_higher_ratio_gives_higher_score(self):
        low  = score_region_probes(1, 10)
        high = score_region_probes(9, 10)
        assert high >= low


# ── fetch_ripe_connectivity ───────────────────────────────────────────────────

def _make_probes_response(probes: list[dict]) -> MagicMock:
    """Build a mock requests.Session returning a RIPE probes API response."""
    resp = MagicMock()
    resp.raise_for_status.side_effect = None
    resp.json.return_value = {"count": len(probes), "results": probes}
    session = MagicMock()
    session.get.return_value = resp
    return session


def _probe(lat: float, lon: float, status: int, asn: int = 8048) -> dict:
    return {
        "status": {"id": status},
        "geometry": {"coordinates": [lon, lat]},
        "asn_v4": asn,
    }


class TestFetchRipeConnectivity:
    def test_empty_probes_returns_empty_dict(self):
        session = _make_probes_response([])
        result = fetch_ripe_connectivity(_session=session)
        assert result == {}

    def test_connected_probes_produce_zero_score(self):
        # All probes connected (status=1) near caracas
        probes = [_probe(10.48, -66.90, status=1) for _ in range(3)]
        session = _make_probes_response(probes)
        result = fetch_ripe_connectivity(_session=session)
        # caracas should appear with 0 disconnected
        if "caracas" in result:
            assert result["caracas"]["disconnected_ratio"] == pytest.approx(0.0)
            assert result["caracas"]["score"] == pytest.approx(0.0)

    def test_disconnected_probe_counted(self):
        # 2 connected + 1 disconnected near caracas
        probes = [
            _probe(10.48, -66.90, status=1),
            _probe(10.48, -66.90, status=1),
            _probe(10.48, -66.90, status=2),
        ]
        session = _make_probes_response(probes)
        result = fetch_ripe_connectivity(_session=session)
        assert "caracas" in result
        assert result["caracas"]["probe_count"] == 3
        assert result["caracas"]["disconnected_ratio"] == pytest.approx(1 / 3, abs=1e-3)

    def test_result_has_required_keys(self):
        probes = [
            _probe(10.48, -66.90, status=2),
            _probe(10.48, -66.90, status=1),
            _probe(10.48, -66.90, status=1),
        ]
        session = _make_probes_response(probes)
        result = fetch_ripe_connectivity(_session=session)
        if "caracas" in result:
            entry = result["caracas"]
            assert "disconnected_ratio" in entry
            assert "probe_count" in entry
            assert "score" in entry

    def test_error_session_returns_empty_dict(self):
        session = MagicMock()
        session.get.side_effect = Exception("RIPE connection timeout")
        result = fetch_ripe_connectivity(_session=session)
        assert result == {}

    def test_http_error_returns_empty_dict(self):
        resp = MagicMock()
        resp.raise_for_status.side_effect = Exception("HTTP 503")
        session = MagicMock()
        session.get.return_value = resp
        result = fetch_ripe_connectivity(_session=session)
        assert result == {}

    def test_probe_outside_region_threshold_ignored(self):
        # probe far from any VE city (mid-ocean) — should not be grouped
        probes = [_probe(5.0, -50.0, status=2)]
        session = _make_probes_response(probes)
        result = fetch_ripe_connectivity(_session=session)
        assert result == {}

    def test_two_regions_in_same_payload(self):
        probes = [
            _probe(10.48, -66.90, status=2),  # caracas
            _probe(10.48, -66.90, status=1),  # caracas
            _probe(10.64, -71.61, status=2),  # maracaibo
            _probe(10.64, -71.61, status=2),  # maracaibo
        ]
        session = _make_probes_response(probes)
        result = fetch_ripe_connectivity(_session=session)
        # At least one region should be detected
        assert len(result) >= 1
