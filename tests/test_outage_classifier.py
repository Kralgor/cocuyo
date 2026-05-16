"""
Tests for pipeline/outage_type_classifier.py.
Simple Phase 2 classifier — 4 types, no ML.
"""
import pytest
from datetime import datetime, timezone

from pipeline.outage_type_classifier import (
    OutageSignals,
    classify_outage_type,
    check_rationing_pattern,
)

# Tuesday 14:00 UTC (typical rationing window)
TUESDAY_14H = datetime(2026, 5, 19, 14, 0, 0, tzinfo=timezone.utc)
# Sunday 03:00 UTC (off-pattern)
SUNDAY_3H = datetime(2026, 5, 17, 3, 0, 0, tzinfo=timezone.utc)


def _signals(
    inet_drop_national: bool = False,
    inet_drop_regional: bool = False,
    adjacent_regions_affected: int = 1,
    crowd_reports_count: int = 5,
    time_since_last_outage_hours: float = 0.0,
) -> OutageSignals:
    return OutageSignals(
        inet_drop_national=inet_drop_national,
        inet_drop_regional=inet_drop_regional,
        adjacent_regions_affected=adjacent_regions_affected,
        crowd_reports_count=crowd_reports_count,
        time_since_last_outage_hours=time_since_last_outage_hours,
    )


# ── classify_outage_type ──────────────────────────────────────────────────────

class TestNationalBlackout:
    def test_many_regions_classified_national(self):
        sig = _signals(adjacent_regions_affected=6, inet_drop_national=True)
        result = classify_outage_type(sig, "maracaibo", TUESDAY_14H)
        assert result["type"] == "national_blackout"

    def test_5_regions_is_national_threshold(self):
        sig = _signals(adjacent_regions_affected=5)
        result = classify_outage_type(sig, "caracas", TUESDAY_14H)
        assert result["type"] == "national_blackout"

    def test_national_inet_drop_alone_triggers_national(self):
        sig = _signals(inet_drop_national=True, adjacent_regions_affected=1)
        result = classify_outage_type(sig, "caracas", SUNDAY_3H)
        assert result["type"] == "national_blackout"

    def test_confidence_present_and_in_range(self):
        sig = _signals(adjacent_regions_affected=7, inet_drop_national=True)
        result = classify_outage_type(sig, "maracaibo", TUESDAY_14H)
        assert 0.0 < result["confidence"] <= 1.0

    def test_explanation_present(self):
        sig = _signals(adjacent_regions_affected=6)
        result = classify_outage_type(sig, "maracaibo", TUESDAY_14H)
        assert isinstance(result["explanation"], str)
        assert len(result["explanation"]) > 0


class TestTransmissionFault:
    def test_multi_region_no_national_drop(self):
        sig = _signals(adjacent_regions_affected=3, inet_drop_regional=True)
        result = classify_outage_type(sig, "maracaibo", SUNDAY_3H)
        assert result["type"] == "transmission_fault"

    def test_2_regions_threshold(self):
        # 2 regions + regional drop = transmission fault, not national
        sig = _signals(adjacent_regions_affected=2, inet_drop_regional=True,
                       inet_drop_national=False)
        result = classify_outage_type(sig, "maracaibo", SUNDAY_3H)
        assert result["type"] == "transmission_fault"

    def test_4_regions_without_national_inet_is_transmission(self):
        sig = _signals(adjacent_regions_affected=4, inet_drop_national=False,
                       inet_drop_regional=True)
        result = classify_outage_type(sig, "caracas", SUNDAY_3H)
        assert result["type"] == "transmission_fault"


class TestRationing:
    def test_schedule_match_returns_rationing(self):
        # maracaibo (Zulia) interdiario, Tuesday 14:00 = prime rationing window
        sig = _signals(time_since_last_outage_hours=48.5)
        result = classify_outage_type(sig, "maracaibo", TUESDAY_14H)
        assert result["type"] == "rationing"

    def test_48h_interval_suggests_rationing(self):
        sig = _signals(time_since_last_outage_hours=48.0)
        result = classify_outage_type(sig, "barquisimeto", TUESDAY_14H)
        assert result["type"] == "rationing"

    def test_24h_interval_suggests_rationing(self):
        sig = _signals(time_since_last_outage_hours=24.5)
        result = classify_outage_type(sig, "san_cristobal", TUESDAY_14H)
        assert result["type"] == "rationing"

    def test_known_region_during_schedule_window(self):
        # san_cristobal daily, 10:00 VET = 14:00 UTC
        start = datetime(2026, 5, 18, 14, 0, 0, tzinfo=timezone.utc)
        sig = _signals()
        result = classify_outage_type(sig, "san_cristobal", start)
        assert result["type"] == "rationing"


class TestUnknown:
    def test_single_region_no_signals_unknown(self):
        sig = _signals(adjacent_regions_affected=1, inet_drop_national=False,
                       inet_drop_regional=False, time_since_last_outage_hours=0.0)
        result = classify_outage_type(sig, "maracaibo", SUNDAY_3H)
        assert result["type"] == "unknown"

    def test_off_schedule_low_signal_unknown(self):
        # Middle of night, single region, no internet drop, no pattern
        sig = _signals()
        result = classify_outage_type(sig, "ciudad_guayana", SUNDAY_3H)
        assert result["type"] == "unknown"


class TestReturnShape:
    def test_all_keys_present(self):
        sig = _signals(adjacent_regions_affected=6)
        result = classify_outage_type(sig, "maracaibo", TUESDAY_14H)
        assert set(result.keys()) >= {"type", "confidence", "explanation"}

    def test_type_is_valid_string(self):
        valid = {"rationing", "transmission_fault", "national_blackout", "unknown"}
        for sig_kwargs, region, dt in [
            ({"adjacent_regions_affected": 6}, "maracaibo", TUESDAY_14H),
            ({"adjacent_regions_affected": 3, "inet_drop_regional": True}, "caracas", SUNDAY_3H),
            ({"time_since_last_outage_hours": 48.0}, "maracaibo", TUESDAY_14H),
            ({}, "ciudad_guayana", SUNDAY_3H),
        ]:
            result = classify_outage_type(_signals(**sig_kwargs), region, dt)
            assert result["type"] in valid, f"invalid type: {result['type']}"


# ── check_rationing_pattern ───────────────────────────────────────────────────

class TestCheckRationingPattern:
    def test_zulia_interdiario_afternoon_matches(self):
        # Zulia (maracaibo): interdiario, typical_start_hour=13
        result = check_rationing_pattern("maracaibo", hour=14, day_of_week=1)
        assert result["matches"] is True
        assert result["confidence"] > 0.5

    def test_zulia_morning_does_not_match(self):
        # Too early for Zulia typical window
        result = check_rationing_pattern("maracaibo", hour=8, day_of_week=1)
        assert result["matches"] is False

    def test_tachira_daily_morning_matches(self):
        # san_cristobal: daily, 10:00 VET = 14:00 UTC
        result = check_rationing_pattern("san_cristobal", hour=14, day_of_week=0)
        assert result["matches"] is True
        assert result["confidence"] > 0.5

    def test_tachira_any_day_matches_daily(self):
        # Daily pattern → weekday should match; 11:00 VET = 15:00 UTC
        result = check_rationing_pattern("san_cristobal", hour=15, day_of_week=3)
        assert result["matches"] is True

    def test_unknown_region_no_match(self):
        result = check_rationing_pattern("ciudad_guayana", hour=14, day_of_week=1)
        assert result["matches"] is False
        assert result["confidence"] == 0.0

    def test_return_shape(self):
        result = check_rationing_pattern("maracaibo", hour=14, day_of_week=1)
        assert "matches" in result
        assert "confidence" in result
        assert "pattern" in result

    def test_pattern_field_present_when_match(self):
        result = check_rationing_pattern("maracaibo", hour=14, day_of_week=1)
        assert result["pattern"] is not None

    def test_pattern_field_none_when_no_match(self):
        result = check_rationing_pattern("ciudad_guayana", hour=14, day_of_week=1)
        assert result["pattern"] is None

    def test_merida_daily_noon_matches(self):
        # merida: daily, noon VET = 16:00 UTC
        result = check_rationing_pattern("merida", hour=16, day_of_week=2)
        assert result["matches"] is True

    def test_confidence_in_range(self):
        result = check_rationing_pattern("maracaibo", hour=14, day_of_week=1)
        assert 0.0 <= result["confidence"] <= 1.0
