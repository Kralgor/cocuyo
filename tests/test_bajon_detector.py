"""Tests for pipeline/bajon_detector.py"""

from datetime import datetime, timedelta, timezone
import pytest
from pipeline.bajon_detector import (
    BajonReport, WaveDetection, detect_waves,
    WAVE_THRESHOLD, WINDOW_MINUTES,
)

REF = datetime(2026, 5, 18, 14, 0, 0, tzinfo=timezone.utc)


def make_reports(region: str, count: int, minutes_ago: float = 5.0) -> list[BajonReport]:
    ts = REF - timedelta(minutes=minutes_ago)
    return [BajonReport(region=region, timestamp=ts) for _ in range(count)]


class TestWaveThreshold:
    def test_at_threshold_no_wave(self):
        """Exactly WAVE_THRESHOLD reports → no wave (must be strictly >)."""
        reports = make_reports("caracas", WAVE_THRESHOLD)
        result  = detect_waves(reports, reference_time=REF)
        assert not result["caracas"].wave_detected

    def test_one_above_threshold_wave(self):
        """WAVE_THRESHOLD + 1 reports → wave detected."""
        reports = make_reports("caracas", WAVE_THRESHOLD + 1)
        result  = detect_waves(reports, reference_time=REF)
        assert result["caracas"].wave_detected

    def test_zero_reports_no_wave(self):
        reports = make_reports("caracas", 0)
        result  = detect_waves(reports, reference_time=REF)
        assert "caracas" not in result or not result["caracas"].wave_detected


class TestWindowBoundary:
    def test_reports_inside_window_counted(self):
        inside = make_reports("maracaibo", 6, minutes_ago=WINDOW_MINUTES - 1)
        result = detect_waves(inside, reference_time=REF)
        assert result["maracaibo"].unstable_count_15min == 6

    def test_reports_outside_window_excluded(self):
        outside = make_reports("maracaibo", 10, minutes_ago=WINDOW_MINUTES + 1)
        result  = detect_waves(outside, reference_time=REF)
        # reports outside window → count 0 → no wave
        assert not result["maracaibo"].wave_detected
        assert result["maracaibo"].unstable_count_15min == 0

    def test_mixed_inside_outside(self):
        inside  = make_reports("valencia", 4, minutes_ago=5)
        outside = make_reports("valencia", 10, minutes_ago=WINDOW_MINUTES + 5)
        result  = detect_waves(inside + outside, reference_time=REF)
        assert result["valencia"].unstable_count_15min == 4
        assert not result["valencia"].wave_detected


class TestSeverity:
    def test_no_wave_severity_none(self):
        result = detect_waves(make_reports("merida", 3), reference_time=REF)
        assert result["merida"].severity is None

    def test_mild_6_to_10(self):
        for count in (6, 10):
            result = detect_waves(make_reports("barquisimeto", count), reference_time=REF)
            assert result["barquisimeto"].severity == "mild", f"count={count}"

    def test_moderate_11_to_20(self):
        for count in (11, 20):
            result = detect_waves(make_reports("maracay", count), reference_time=REF)
            assert result["maracay"].severity == "moderate", f"count={count}"

    def test_severe_above_20(self):
        result = detect_waves(make_reports("maracaibo", 21), reference_time=REF)
        assert result["maracaibo"].severity == "severe"

    def test_severe_high_count(self):
        result = detect_waves(make_reports("maracaibo", 50), reference_time=REF)
        assert result["maracaibo"].severity == "severe"


class TestMultiRegion:
    def test_each_region_independent(self):
        reports = (
            make_reports("caracas",   3, minutes_ago=5)   # below threshold
          + make_reports("maracaibo", 8, minutes_ago=5)   # wave
          + make_reports("valencia",  6, minutes_ago=5)   # wave (boundary)
        )
        result = detect_waves(reports, reference_time=REF)
        assert not result["caracas"].wave_detected
        assert     result["maracaibo"].wave_detected
        assert     result["valencia"].wave_detected

    def test_wave_in_one_region_not_others(self):
        reports = (
            make_reports("barinas", 10, minutes_ago=5)
          + make_reports("merida",  2,  minutes_ago=5)
        )
        result = detect_waves(reports, reference_time=REF)
        assert     result["barinas"].wave_detected
        assert not result["merida"].wave_detected


class TestNaiveDatetime:
    def test_naive_timestamps_treated_as_utc(self):
        """Naive datetimes (no tzinfo) should not raise; treated as UTC."""
        naive_ts = REF.replace(tzinfo=None) - timedelta(minutes=5)
        reports  = [BajonReport(region="cumana", timestamp=naive_ts) for _ in range(6)]
        result   = detect_waves(reports, reference_time=REF)
        assert result["cumana"].wave_detected


class TestCustomParams:
    def test_custom_threshold(self):
        reports = make_reports("barcelona", 3)
        result  = detect_waves(reports, reference_time=REF, threshold=2)
        assert result["barcelona"].wave_detected

    def test_custom_window_minutes(self):
        reports = make_reports("maturin", 6, minutes_ago=8)
        # window=5 min → 8min-ago reports outside → no wave
        no_wave = detect_waves(reports, reference_time=REF, window_minutes=5)
        # window=10 min → inside → wave
        wave    = detect_waves(reports, reference_time=REF, window_minutes=10)
        assert not no_wave["maturin"].wave_detected
        assert     wave["maturin"].wave_detected
