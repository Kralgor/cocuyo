"""
Tests for pipeline/zone_mapper.py.
"""
import pytest
from datetime import datetime, timezone, timedelta

from pipeline.zone_mapper import (
    OutageCluster,
    ZoneMapper,
    compute_avg_duration,
    compute_boundary,
    compute_overlap,
    find_typical_times,
    haversine,
)

NOW = datetime(2026, 5, 16, 13, 0, 0, tzinfo=timezone.utc)


def _report(lat, lon, region="maracaibo", offset_s=0):
    return {
        "lat":       lat,
        "lon":       lon,
        "region":    region,
        "timestamp": NOW + timedelta(seconds=offset_s),
    }


def _cluster(reports, region="maracaibo", started=None, ended=None):
    lats = [r["lat"] for r in reports]
    lons = [r["lon"] for r in reports]
    c_lat = sum(lats) / len(lats)
    c_lon = sum(lons) / len(lons)
    return OutageCluster(
        cluster_id="c0",
        region=region,
        reports=reports,
        centroid_lat=c_lat,
        centroid_lon=c_lon,
        radius_km=1.0,
        started_at=started or NOW,
        ended_at=ended,
    )


# ── haversine ────────────────────────────────────────────────────────────────

class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine(10.48, -66.90, 10.48, -66.90) == pytest.approx(0.0)

    def test_equator_1_degree_longitude(self):
        # 1° longitude at equator ≈ 111.2 km
        d = haversine(0.0, 0.0, 0.0, 1.0)
        assert d == pytest.approx(111.2, abs=0.5)

    def test_equator_1_degree_latitude(self):
        # 1° latitude ≈ 111.2 km everywhere
        d = haversine(0.0, 0.0, 1.0, 0.0)
        assert d == pytest.approx(111.2, abs=0.5)

    def test_caracas_to_maracaibo(self):
        # ~515 km apart (verified against haversine formula)
        d = haversine(10.4806, -66.9036, 10.6427, -71.6125)
        assert d == pytest.approx(515, abs=10)

    def test_caracas_to_valencia(self):
        # ~126 km apart
        d = haversine(10.4806, -66.9036, 10.1579, -68.0075)
        assert d == pytest.approx(126, abs=5)

    def test_symmetric(self):
        d1 = haversine(10.48, -66.90, 10.16, -68.00)
        d2 = haversine(10.16, -68.00, 10.48, -66.90)
        assert d1 == pytest.approx(d2)

    def test_returns_km_not_meters(self):
        # Caracas-Valencia is ~126 km, not 126000
        d = haversine(10.4806, -66.9036, 10.1579, -68.0075)
        assert 100 < d < 200

    def test_nearby_points_under_2km(self):
        # ~0.018° ≈ 2 km at this latitude
        d = haversine(10.48, -66.90, 10.498, -66.90)
        assert d < 2.5


# ── cluster_concurrent_reports ────────────────────────────────────────────────

class TestClusterConcurrentReports:
    def setup_method(self):
        self.zm = ZoneMapper()

    def test_empty_input_returns_empty(self):
        assert self.zm.cluster_concurrent_reports([]) == []

    def test_single_report_no_cluster(self):
        result = self.zm.cluster_concurrent_reports([_report(10.48, -66.90)])
        assert result == []

    def test_two_nearby_simultaneous_reports_cluster(self):
        reports = [_report(10.480, -66.900), _report(10.481, -66.901)]
        result  = self.zm.cluster_concurrent_reports(reports)
        assert len(result) == 1
        assert len(result[0].reports) == 2

    def test_two_distant_reports_no_cluster(self):
        # >2 km apart (Caracas vs Valencia)
        reports = [_report(10.48, -66.90), _report(10.16, -68.00)]
        result  = self.zm.cluster_concurrent_reports(reports)
        assert result == []

    def test_two_nearby_outside_time_window_no_cluster(self):
        # same location, 20 min apart (default window=15)
        reports = [_report(10.480, -66.900, offset_s=0),
                   _report(10.481, -66.901, offset_s=20*60)]
        result = self.zm.cluster_concurrent_reports(reports)
        assert result == []

    def test_three_reports_two_close_one_far(self):
        reports = [
            _report(10.480, -66.900),
            _report(10.481, -66.901),
            _report(10.160, -68.007),  # Valencia — far
        ]
        result = self.zm.cluster_concurrent_reports(reports)
        assert len(result) == 1
        assert len(result[0].reports) == 2

    def test_cluster_centroid_is_mean(self):
        reports = [_report(10.480, -66.900), _report(10.482, -66.902)]
        result  = self.zm.cluster_concurrent_reports(reports)
        assert result[0].centroid_lat == pytest.approx(10.481)
        assert result[0].centroid_lon == pytest.approx(-66.901)

    def test_cluster_radius_set(self):
        reports = [_report(10.480, -66.900), _report(10.481, -66.901)]
        result  = self.zm.cluster_concurrent_reports(reports)
        assert result[0].radius_km >= 0.0

    def test_cluster_started_at_is_earliest(self):
        reports = [
            _report(10.480, -66.900, offset_s=60),
            _report(10.481, -66.901, offset_s=0),
        ]
        result = self.zm.cluster_concurrent_reports(reports)
        assert result[0].started_at == NOW  # offset_s=0

    def test_cluster_id_sequential(self):
        reports = [_report(10.480, -66.900), _report(10.481, -66.901)]
        result  = self.zm.cluster_concurrent_reports(reports)
        assert result[0].cluster_id == "cluster_0"

    def test_region_from_seed_report(self):
        reports = [_report(10.480, -66.900, region="caracas"),
                   _report(10.481, -66.901, region="caracas")]
        result = self.zm.cluster_concurrent_reports(reports)
        assert result[0].region == "caracas"

    def test_custom_distance_threshold(self):
        # 0.5 km threshold — reports ~1 km apart should not cluster
        r1 = _report(10.480, -66.900)
        r2 = _report(10.489, -66.900)  # ~1 km north
        result = self.zm.cluster_concurrent_reports([r1, r2], distance_threshold_km=0.5)
        assert result == []

    def test_custom_time_window(self):
        r1 = _report(10.480, -66.900, offset_s=0)
        r2 = _report(10.481, -66.901, offset_s=5*60)  # 5 min apart
        result = self.zm.cluster_concurrent_reports([r1, r2], time_window_min=3)
        assert result == []  # 5 min > 3 min window


# ── compute_boundary ──────────────────────────────────────────────────────────

class TestComputeBoundary:
    def test_empty_returns_none(self):
        assert compute_boundary([]) is None

    def test_single_point(self):
        b = compute_boundary([(10.5, -66.9)])
        assert b["min_lat"] == b["max_lat"] == 10.5
        assert b["min_lon"] == b["max_lon"] == -66.9

    def test_multiple_points(self):
        points = [(10.4, -67.0), (10.6, -66.8), (10.5, -66.9)]
        b = compute_boundary(points)
        assert b["min_lat"] == pytest.approx(10.4)
        assert b["max_lat"] == pytest.approx(10.6)
        assert b["min_lon"] == pytest.approx(-67.0)
        assert b["max_lon"] == pytest.approx(-66.8)


# ── compute_avg_duration ──────────────────────────────────────────────────────

class TestComputeAvgDuration:
    def test_no_ended_at_returns_none(self):
        c = _cluster([_report(10.48, -66.90)], ended=None)
        assert compute_avg_duration([c]) is None

    def test_single_cluster_with_duration(self):
        c = _cluster([_report(10.48, -66.90)],
                     started=NOW, ended=NOW + timedelta(minutes=90))
        assert compute_avg_duration([c]) == 90

    def test_avg_of_multiple(self):
        c1 = _cluster([_report(10.48, -66.90)],
                      started=NOW, ended=NOW + timedelta(minutes=60))
        c2 = _cluster([_report(10.48, -66.90)],
                      started=NOW, ended=NOW + timedelta(minutes=120))
        assert compute_avg_duration([c1, c2]) == 90

    def test_mixed_ended_and_not(self):
        c1 = _cluster([_report(10.48, -66.90)],
                      started=NOW, ended=NOW + timedelta(minutes=60))
        c2 = _cluster([_report(10.48, -66.90)], ended=None)
        assert compute_avg_duration([c1, c2]) == 60


# ── find_typical_times ────────────────────────────────────────────────────────

class TestFindTypicalTimes:
    def test_most_common_hour_first(self):
        noon    = NOW.replace(hour=12)
        evening = NOW.replace(hour=18)
        clusters = [
            _cluster([_report(10.48, -66.90)], started=noon),
            _cluster([_report(10.48, -66.90)], started=noon),
            _cluster([_report(10.48, -66.90)], started=evening),
        ]
        result = find_typical_times(clusters)
        assert result[0][0] == 12  # hour 12 most frequent

    def test_max_three_returned(self):
        clusters = [
            _cluster([_report(10.48, -66.90)], started=NOW.replace(hour=h))
            for h in [10, 12, 14, 16]
        ]
        result = find_typical_times(clusters)
        assert len(result) <= 3
