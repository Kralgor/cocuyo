"""
Tests for pipeline/validation.py — ReportValidator.

Uses public interface only: validate(report, recent_reports, now).
recent_reports simulates pipeline-prefetched rows from same region.
"""

import pytest
from datetime import datetime, timedelta, timezone

from pipeline.validation import ReportValidator, ValidationResult

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
validator = ReportValidator()


# ── helpers ──────────────────────────────────────────────────────────────────

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
    ts = NOW - timedelta(minutes=minutes_ago)
    return [
        {
            "ip_hash": ip_hash,
            "status": status,
            "region": region,
            "created_at": ts,
            "lat": 10.6427,
            "lon": -71.6125,
        }
        for _ in range(n)
    ]


def regional_reports(n: int, status: str, minutes_ago: int = 5) -> list[dict]:
    """n reports from n different IPs — simulates regional consensus."""
    ts = NOW - timedelta(minutes=minutes_ago)
    return [
        {
            "ip_hash": f"hash_user_{i}",
            "status": status,
            "region": "maracaibo",
            "created_at": ts,
            "lat": 10.6427,
            "lon": -71.6125,
        }
        for i in range(n)
    ]


# ── tracer bullet ─────────────────────────────────────────────────────────────

class TestAcceptedPath:
    def test_valid_report_no_history_accepted(self):
        result = validator.validate(make_report(), [], now=NOW)
        assert result.accepted is True
        assert result.weight == pytest.approx(1.0)
        assert result.rejection_reason is None
        assert result.flags == []


# ── IP rate limiting ──────────────────────────────────────────────────────────

class TestIpRate:
    def test_below_soft_limit_no_flag(self):
        result = validator.validate(make_report(), past_reports(2), now=NOW)
        assert result.accepted is True
        assert not any("rate" in f for f in result.flags)

    def test_at_soft_limit_flagged(self):
        result = validator.validate(make_report(), past_reports(3), now=NOW)
        assert result.accepted is True
        assert any("rate" in f for f in result.flags)

    def test_above_soft_limit_still_flagged(self):
        result = validator.validate(make_report(), past_reports(5), now=NOW)
        assert result.accepted is True
        assert any("rate" in f for f in result.flags)

    def test_at_hard_limit_rejected(self):
        result = validator.validate(make_report(), past_reports(6), now=NOW)
        assert result.accepted is False
        assert result.rejection_reason is not None
        assert result.weight == pytest.approx(0.0)

    def test_beyond_hard_limit_rejected(self):
        result = validator.validate(make_report(), past_reports(10), now=NOW)
        assert result.accepted is False

    def test_reports_older_than_window_not_counted(self):
        old = past_reports(6, minutes_ago=31)
        result = validator.validate(make_report(), old, now=NOW)
        assert result.accepted is True

    def test_different_ip_reports_not_counted(self):
        others = past_reports(6, ip_hash="hash_b")
        result = validator.validate(make_report(ip_hash="hash_a"), others, now=NOW)
        assert result.accepted is True


# ── geo consistency ───────────────────────────────────────────────────────────

class TestGeoConsistency:
    def test_coords_inside_venezuela_full_weight(self):
        result = validator.validate(make_report(lat=10.6, lon=-71.6), [], now=NOW)
        assert result.accepted is True
        assert result.weight == pytest.approx(1.0)

    def test_missing_gps_accepted_with_weight_penalty(self):
        result = validator.validate(make_report(lat=None, lon=None), [], now=NOW)
        assert result.accepted is True
        assert result.weight == pytest.approx(0.7)

    def test_lat_above_north_bound_rejected(self):
        result = validator.validate(make_report(lat=13.0, lon=-71.6), [], now=NOW)
        assert result.accepted is False
        assert result.rejection_reason is not None

    def test_lat_below_south_bound_rejected(self):
        result = validator.validate(make_report(lat=0.4, lon=-71.6), [], now=NOW)
        assert result.accepted is False

    def test_lon_east_of_bound_rejected(self):
        result = validator.validate(make_report(lat=10.0, lon=-59.0), [], now=NOW)
        assert result.accepted is False

    def test_lon_west_of_bound_rejected(self):
        result = validator.validate(make_report(lat=10.0, lon=-74.0), [], now=NOW)
        assert result.accepted is False

    def test_boundary_coords_accepted(self):
        # Exact boundary values are accepted (inclusive)
        result = validator.validate(make_report(lat=0.5, lon=-73.5), [], now=NOW)
        assert result.accepted is True
        result = validator.validate(make_report(lat=12.5, lon=-59.5), [], now=NOW)
        assert result.accepted is True


# ── contradiction detection ───────────────────────────────────────────────────

class TestContradiction:
    def test_agreeing_with_consensus_no_flag(self):
        context = regional_reports(8, "no_power")
        result = validator.validate(make_report(status="no_power"), context, now=NOW)
        assert not any("contradiction" in f for f in result.flags)

    def test_contradicts_no_power_consensus_flagged(self):
        context = regional_reports(8, "no_power")
        result = validator.validate(make_report(status="power_back"), context, now=NOW)
        assert any("contradiction" in f for f in result.flags)
        assert result.accepted is True  # flag only, not rejection

    def test_contradicts_power_back_consensus_flagged(self):
        context = regional_reports(8, "power_back")
        result = validator.validate(make_report(status="no_power"), context, now=NOW)
        assert any("contradiction" in f for f in result.flags)

    def test_below_min_report_count_no_flag(self):
        # 4 reports — below the 5-report minimum for consensus
        context = regional_reports(4, "no_power")
        result = validator.validate(make_report(status="power_back"), context, now=NOW)
        assert not any("contradiction" in f for f in result.flags)

    def test_below_consensus_threshold_no_flag(self):
        # 5 reports but only 60% opposite — below 70% threshold
        context = (
            regional_reports(3, "no_power")
            + regional_reports(2, "power_back")
        )
        result = validator.validate(make_report(status="power_back"), context, now=NOW)
        assert not any("contradiction" in f for f in result.flags)

    def test_unstable_not_flagged_against_no_power_consensus(self):
        context = regional_reports(8, "no_power")
        result = validator.validate(make_report(status="unstable"), context, now=NOW)
        assert not any("contradiction" in f for f in result.flags)

    def test_unstable_not_flagged_against_power_back_consensus(self):
        context = regional_reports(8, "power_back")
        result = validator.validate(make_report(status="unstable"), context, now=NOW)
        assert not any("contradiction" in f for f in result.flags)


# ── device fingerprint stub (ADR-005) ─────────────────────────────────────────

class TestDeviceFingerprint:
    def test_fingerprint_present_does_not_cause_rejection(self):
        report = make_report(device_fingerprint="fp_abc123")
        result = validator.validate(report, [], now=NOW)
        assert result.accepted is True  # deferred to Phase 4 per ADR-005

    def test_no_fingerprint_accepted(self):
        result = validator.validate(make_report(device_fingerprint=None), [], now=NOW)
        assert result.accepted is True


# ── combined scenarios ────────────────────────────────────────────────────────

class TestCombined:
    def test_missing_gps_plus_rate_flag_both_recorded(self):
        report = make_report(lat=None, lon=None)
        result = validator.validate(report, past_reports(3), now=NOW)
        assert result.accepted is True
        assert result.weight == pytest.approx(0.7)
        assert any("rate" in f for f in result.flags)

    def test_missing_gps_plus_contradiction_flag(self):
        report = make_report(lat=None, lon=None, status="power_back")
        context = regional_reports(8, "no_power")
        result = validator.validate(report, context, now=NOW)
        assert result.accepted is True
        assert result.weight == pytest.approx(0.7)
        assert any("contradiction" in f for f in result.flags)
