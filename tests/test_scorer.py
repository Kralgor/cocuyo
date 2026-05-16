"""
Tests for pipeline/scorer.py — compute_region_score.

Weights: internet=0.35, crowdsource=0.30, satellite=0.20, weather=0.15
Normalization: sum(w*s) / sum(w) over non-None signals only.
"""

import pytest
from pipeline.scorer import compute_region_score, RegionScore


# ── tracer bullet ─────────────────────────────────────────────────────────────

class TestAllNone:
    def test_all_signals_none_returns_no_data(self):
        result = compute_region_score(None)
        assert result.status == "no_data"
        assert result.current_score == pytest.approx(0.0)
        assert result.signals_used == []


# ── Phase 1 crowd-only path ───────────────────────────────────────────────────

class TestCrowdOnly:
    def test_crowd_present_no_passives_returns_unverified_reports(self):
        result = compute_region_score(crowd_score=0.5)
        assert result.status == "unverified_reports"

    def test_crowd_zero_no_passives_is_unverified_not_no_data(self):
        # crowd=0.0 means reports exist (all power_back); not the same as no reports
        result = compute_region_score(crowd_score=0.0)
        assert result.status == "unverified_reports"
        assert result.current_score == pytest.approx(0.0)

    def test_crowd_one_no_passives_score_one(self):
        result = compute_region_score(crowd_score=1.0)
        assert result.status == "unverified_reports"
        assert result.current_score == pytest.approx(1.0)

    def test_crowd_only_full_range_reachable(self):
        low  = compute_region_score(crowd_score=0.0)
        high = compute_region_score(crowd_score=1.0)
        assert low.current_score  == pytest.approx(0.0)
        assert high.current_score == pytest.approx(1.0)

    def test_crowd_mid_score_normalised_to_crowd_weight(self):
        # Only crowd weight (0.30) active; normalised → score equals input
        result = compute_region_score(crowd_score=0.6)
        assert result.current_score == pytest.approx(0.6)


# ── None signals excluded (not treated as zero) ───────────────────────────────

class TestNoneExclusion:
    def test_internet_only_score_equals_internet_value(self):
        # score = (0.35 * 0.50) / 0.35 = 0.50 (not 0.175 if others treated as 0)
        result = compute_region_score(crowd_score=None, internet_score=0.50)
        assert result.current_score == pytest.approx(0.50)
        assert result.status == "likely_outage"

    def test_satellite_only_score_equals_satellite_value(self):
        result = compute_region_score(crowd_score=None, satellite_score=0.80)
        assert result.current_score == pytest.approx(0.80)

    def test_missing_signals_do_not_dilute_score(self):
        # crowd=1.0, internet=1.0 → score=1.0; adding weather=None must not lower it
        without_weather = compute_region_score(crowd_score=1.0, internet_score=1.0)
        with_none_weather = compute_region_score(
            crowd_score=1.0, internet_score=1.0, weather_score=None
        )
        assert without_weather.current_score == pytest.approx(with_none_weather.current_score)


# ── two-signal normalization ──────────────────────────────────────────────────

class TestTwoSignals:
    def test_crowd_plus_internet_reaches_confirmed_outage(self):
        # score = (0.30*0.80 + 0.35*0.80) / 0.65 = 0.80
        result = compute_region_score(crowd_score=0.80, internet_score=0.80)
        assert result.current_score == pytest.approx(0.80, abs=1e-6)
        assert result.status == "confirmed_outage"

    def test_crowd_plus_internet_low_scores_normal(self):
        # (0.30*0.10 + 0.35*0.10) / 0.65 = 0.10
        result = compute_region_score(crowd_score=0.10, internet_score=0.10)
        assert result.current_score == pytest.approx(0.10, abs=1e-6)
        assert result.status == "normal"

    def test_crowd_plus_internet_weighted_correctly(self):
        # crowd=0.0, internet=1.0 → (0.35*1.0) / 0.65 ≈ 0.538
        result = compute_region_score(crowd_score=0.0, internet_score=1.0)
        assert result.current_score == pytest.approx(0.35 / 0.65, abs=1e-6)


# ── four-signal normalization ─────────────────────────────────────────────────

class TestFourSignals:
    def test_all_ones_score_one(self):
        result = compute_region_score(
            crowd_score=1.0, internet_score=1.0, satellite_score=1.0, weather_score=1.0
        )
        assert result.current_score == pytest.approx(1.0)

    def test_all_zeros_score_zero_status_normal(self):
        result = compute_region_score(
            crowd_score=0.0, internet_score=0.0, satellite_score=0.0, weather_score=0.0
        )
        assert result.current_score == pytest.approx(0.0)
        assert result.status == "normal"

    def test_four_signal_weighted_sum_verified(self):
        # internet=0.8, crowd=0.6, sat=0.7, weather=0.5
        # score = (0.35*0.8 + 0.30*0.6 + 0.20*0.7 + 0.15*0.5) / 1.0
        #       = (0.280 + 0.180 + 0.140 + 0.075) = 0.675
        result = compute_region_score(
            crowd_score=0.6, internet_score=0.8, satellite_score=0.7, weather_score=0.5
        )
        assert result.current_score == pytest.approx(0.675, abs=1e-6)
        assert result.status == "likely_outage"

    def test_four_signal_high_scores_confirmed_outage(self):
        # internet=0.95, crowd=0.9, sat=0.85, weather=0.75
        # = (0.35*0.95 + 0.30*0.90 + 0.20*0.85 + 0.15*0.75) / 1.0
        # = (0.3325 + 0.270 + 0.170 + 0.1125) = 0.885
        result = compute_region_score(
            crowd_score=0.90, internet_score=0.95, satellite_score=0.85, weather_score=0.75
        )
        assert result.current_score == pytest.approx(0.885, abs=1e-6)
        assert result.status == "confirmed_outage"


# ── status thresholds ─────────────────────────────────────────────────────────

class TestThresholds:
    """Use internet-only signal so thresholds apply (passive present)."""

    def test_score_below_025_is_normal(self):
        result = compute_region_score(crowd_score=None, internet_score=0.10)
        assert result.status == "normal"

    def test_score_at_025_is_at_risk(self):
        result = compute_region_score(crowd_score=None, internet_score=0.25)
        assert result.status == "at_risk"

    def test_score_mid_range_at_risk(self):
        result = compute_region_score(crowd_score=None, internet_score=0.35)
        assert result.status == "at_risk"

    def test_score_at_045_is_likely_outage(self):
        result = compute_region_score(crowd_score=None, internet_score=0.45)
        assert result.status == "likely_outage"

    def test_score_at_070_is_likely_outage(self):
        # 0.70 is NOT above 0.70 → likely_outage, not confirmed
        result = compute_region_score(crowd_score=None, internet_score=0.70)
        assert result.status == "likely_outage"

    def test_score_above_070_is_confirmed_outage(self):
        result = compute_region_score(crowd_score=None, internet_score=0.80)
        assert result.status == "confirmed_outage"


# ── output fields ─────────────────────────────────────────────────────────────

class TestOutputFields:
    def test_signals_used_lists_non_none_signals(self):
        result = compute_region_score(crowd_score=0.5, internet_score=0.8)
        assert "crowdsource" in result.signals_used
        assert "internet" in result.signals_used
        assert "satellite" not in result.signals_used
        assert "weather" not in result.signals_used

    def test_signals_used_empty_when_all_none(self):
        result = compute_region_score(None)
        assert result.signals_used == []

    def test_signals_used_all_four(self):
        result = compute_region_score(
            crowd_score=0.5, internet_score=0.5, satellite_score=0.5, weather_score=0.5
        )
        assert set(result.signals_used) == {"internet", "crowdsource", "satellite", "weather"}

    def test_prediction_score_always_none(self):
        result = compute_region_score(crowd_score=0.9, internet_score=0.9)
        assert result.prediction_score is None

    def test_prediction_text_always_none(self):
        result = compute_region_score(crowd_score=0.9)
        assert result.prediction_text is None

    def test_prediction_fields_none_even_all_signals_max(self):
        result = compute_region_score(
            crowd_score=1.0, internet_score=1.0, satellite_score=1.0, weather_score=1.0
        )
        assert result.prediction_score is None
        assert result.prediction_text is None
