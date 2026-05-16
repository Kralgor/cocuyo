"""
T-025B: tests for full OutageSignature classifier (6 types).
Existing Phase 2 tests (test_outage_classifier.py) must still pass.
"""
import pytest
from datetime import datetime, timezone

from pipeline.outage_type_classifier import OutageSignature, classify_outage_type, build_explanation

NOW = datetime(2026, 5, 19, 14, 0, 0, tzinfo=timezone.utc)  # Tuesday 14:00 UTC

_VALID_TYPES = {
    "rationing", "feeder_fault", "substation_fault",
    "transmission_fault", "national_blackout", "weather_damage",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _sig(**kwargs) -> OutageSignature:
    defaults = dict(
        regions_affected=["maracaibo"],
        zones_affected=["zone_0"],
        total_zones_in_region=10,
        started_at=NOW,
        day_of_week=1,                   # Tuesday
        matches_known_schedule=False,
        time_since_last_outage_hours=0.0,
        reports_first_5min=2,
        reports_first_15min=5,
        inet_drop_pct=10.0,
        inet_drop_speed="none",
        reports_mention_explosion=0,
        reports_mention_transformer=0,
        reports_mention_smoke_fire=0,
        reports_mention_fluctuation=0,
        active_storm=False,
        wind_speed_kmh=10.0,
        lightning_nearby=False,
        similar_outage_count_90days=5,
    )
    defaults.update(kwargs)
    return OutageSignature(**defaults)


# ── return shape ──────────────────────────────────────────────────────────────

class TestReturnShape:
    def test_required_keys_present(self):
        result = classify_outage_type(_sig())
        assert {"type", "confidence", "all_scores", "explanation"} <= set(result.keys())

    def test_type_is_valid(self):
        result = classify_outage_type(_sig())
        assert result["type"] in _VALID_TYPES

    def test_all_scores_keys_are_all_6_types(self):
        result = classify_outage_type(_sig())
        assert set(result["all_scores"].keys()) == _VALID_TYPES

    def test_scores_sum_to_1(self):
        result = classify_outage_type(_sig())
        total = sum(result["all_scores"].values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_confidence_equals_best_type_score(self):
        result = classify_outage_type(_sig())
        assert result["confidence"] == result["all_scores"][result["type"]]

    def test_explanation_is_nonempty_string(self):
        result = classify_outage_type(_sig())
        assert isinstance(result["explanation"], str)
        assert len(result["explanation"]) > 0


# ── national_blackout ─────────────────────────────────────────────────────────

class TestNationalBlackout:
    def test_5_regions_instant_inet_drop(self):
        sig = _sig(
            regions_affected=["r1","r2","r3","r4","r5"],
            inet_drop_pct=90.0, inet_drop_speed="instant",
        )
        assert classify_outage_type(sig)["type"] == "national_blackout"

    def test_6_regions_wins_national(self):
        sig = _sig(regions_affected=["r1","r2","r3","r4","r5","r6"])
        assert classify_outage_type(sig)["type"] == "national_blackout"

    def test_national_blackout_score_highest(self):
        sig = _sig(
            regions_affected=["r1","r2","r3","r4","r5","r6"],
            inet_drop_pct=95.0, inet_drop_speed="instant",
        )
        result = classify_outage_type(sig)
        assert result["all_scores"]["national_blackout"] == max(result["all_scores"].values())


# ── transmission_fault ────────────────────────────────────────────────────────

class TestTransmissionFault:
    def test_2_regions_instant_inet_drop(self):
        # Realistic: transmission fault → multiple regions + instant inet drop
        sig = _sig(
            regions_affected=["maracaibo", "maracay"],
            zones_affected=["z0", "z1", "z2"],
            inet_drop_pct=85.0, inet_drop_speed="instant",
            matches_known_schedule=False,
            similar_outage_count_90days=1,
        )
        result = classify_outage_type(sig)
        assert result["type"] == "transmission_fault"

    def test_transmission_score_boosted_by_instant_regional_inet(self):
        sig = _sig(
            regions_affected=["maracaibo","caracas"],
            inet_drop_pct=85.0, inet_drop_speed="instant",
        )
        result = classify_outage_type(sig)
        assert result["all_scores"]["transmission_fault"] > 0


# ── feeder_fault ──────────────────────────────────────────────────────────────

class TestFeederFault:
    def test_explosion_single_zone_rare(self):
        sig = _sig(
            zones_affected=["zone_0"],
            reports_mention_explosion=2,
            similar_outage_count_90days=1,
            matches_known_schedule=False,
        )
        assert classify_outage_type(sig)["type"] == "feeder_fault"

    def test_transformer_reports_boosts_feeder(self):
        sig = _sig(
            reports_mention_transformer=5,
            similar_outage_count_90days=1,
            matches_known_schedule=False,
        )
        result = classify_outage_type(sig)
        assert result["all_scores"]["feeder_fault"] > result["all_scores"]["rationing"]

    def test_smoke_fire_boosts_feeder(self):
        sig = _sig(
            reports_mention_smoke_fire=3,
            similar_outage_count_90days=1,
        )
        result = classify_outage_type(sig)
        assert result["all_scores"]["feeder_fault"] > 0


# ── substation_fault ──────────────────────────────────────────────────────────

class TestSubstationFault:
    def test_3_zones_no_schedule_match(self):
        sig = _sig(
            zones_affected=["z0","z1","z2"],
            matches_known_schedule=False,
            similar_outage_count_90days=1,
            time_since_last_outage_hours=0.0,
        )
        assert classify_outage_type(sig)["type"] == "substation_fault"

    def test_substation_score_boosted_by_fluctuations(self):
        sig = _sig(reports_mention_fluctuation=8)
        result = classify_outage_type(sig)
        assert result["all_scores"]["substation_fault"] > 0


# ── weather_damage ────────────────────────────────────────────────────────────

class TestWeatherDamage:
    def test_active_storm_lightning_high_wind(self):
        sig = _sig(
            active_storm=True,
            lightning_nearby=True,
            wind_speed_kmh=80.0,
            similar_outage_count_90days=1,
            matches_known_schedule=False,
        )
        assert classify_outage_type(sig)["type"] == "weather_damage"

    def test_no_storm_reduces_weather_score(self):
        sig = _sig(active_storm=False, lightning_nearby=False)
        result = classify_outage_type(sig)
        # weather_damage score must be very low without storm signals
        assert result["all_scores"]["weather_damage"] < 0.15


# ── rationing ─────────────────────────────────────────────────────────────────

class TestRationing:
    def test_schedule_match_high_recurrence(self):
        sig = _sig(
            matches_known_schedule=True,
            similar_outage_count_90days=30,
            time_since_last_outage_hours=48.0,
            day_of_week=1,  # Tuesday
        )
        assert classify_outage_type(sig)["type"] == "rationing"

    def test_schedule_match_boosts_rationing(self):
        sig = _sig(matches_known_schedule=True)
        result = classify_outage_type(sig)
        assert result["all_scores"]["rationing"] > result["all_scores"]["feeder_fault"]

    def test_periodic_interval_contributes(self):
        sig_periodic = _sig(time_since_last_outage_hours=24.0, matches_known_schedule=True)
        sig_aperiodic = _sig(time_since_last_outage_hours=0.0, matches_known_schedule=True)
        r_p = classify_outage_type(sig_periodic)
        r_a = classify_outage_type(sig_aperiodic)
        assert r_p["all_scores"]["rationing"] >= r_a["all_scores"]["rationing"]


# ── normalization ─────────────────────────────────────────────────────────────

class TestNormalization:
    def test_scores_sum_to_1_all_scenarios(self):
        scenarios = [
            _sig(regions_affected=["r1","r2","r3","r4","r5"]),
            _sig(reports_mention_explosion=2, similar_outage_count_90days=1),
            _sig(active_storm=True, lightning_nearby=True, wind_speed_kmh=80),
            _sig(matches_known_schedule=True, similar_outage_count_90days=25),
            _sig(zones_affected=["z0","z1","z2"], matches_known_schedule=False),
        ]
        for sig in scenarios:
            result = classify_outage_type(sig)
            total = sum(result["all_scores"].values())
            assert total == pytest.approx(1.0, abs=0.01), f"scores sum={total} for sig={sig}"

    def test_all_scores_between_0_and_1(self):
        result = classify_outage_type(_sig(matches_known_schedule=True))
        for t, v in result["all_scores"].items():
            assert 0.0 <= v <= 1.0, f"{t}={v} out of range"


# ── build_explanation ─────────────────────────────────────────────────────────

class TestBuildExplanation:
    def test_each_type_returns_nonempty_string(self):
        sig = _sig()
        for t in _VALID_TYPES:
            exp = build_explanation(t, sig)
            assert isinstance(exp, str) and len(exp) > 0, f"empty explanation for {t}"

    def test_unknown_type_returns_fallback(self):
        exp = build_explanation("nonexistent_type", _sig())
        assert isinstance(exp, str)


# ── backward compatibility ────────────────────────────────────────────────────

class TestBackwardCompat:
    def test_outsage_signals_still_importable(self):
        from pipeline.outage_type_classifier import OutageSignals
        assert OutageSignals is not None

    def test_outsage_signals_classify_still_works(self):
        from pipeline.outage_type_classifier import OutageSignals, classify_outage_type
        from datetime import datetime, timezone
        sig = OutageSignals(
            inet_drop_national=True,
            inet_drop_regional=False,
            adjacent_regions_affected=6,
            crowd_reports_count=10,
            time_since_last_outage_hours=0.0,
        )
        result = classify_outage_type(
            sig, region="maracaibo",
            started_at=datetime(2026, 5, 19, 14, 0, 0, tzinfo=timezone.utc),
        )
        assert result["type"] == "national_blackout"
