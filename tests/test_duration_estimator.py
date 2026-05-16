"""
Tests for pipeline/duration_estimator.py.
Offline — pure functions, no external calls.
"""
import pytest
from datetime import datetime, timedelta, timezone

from pipeline.duration_estimator import (
    estimate_remaining,
    fallback_estimate,
    survival_estimate,
)

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)

# 30 historical durations (minutes): uniform 60-300 range
_DURATIONS_30 = list(range(60, 360, 10))   # 60,70,...,350 → 30 items
# 20 historical durations
_DURATIONS_20 = list(range(60, 260, 10))   # 60,70,...,250 → 20 items
# Sparse (< 5 usable after filtering)
_DURATIONS_SPARSE = [10, 20, 25, 30, 35]   # all shorter than elapsed=60


# ── survival_estimate ─────────────────────────────────────────────────────────

class TestSurvivalEstimate:
    def test_returns_required_keys(self):
        result = survival_estimate(_DURATIONS_30, elapsed=60)
        assert {"optimistic_remaining_min", "median_remaining_min",
                "pessimistic_remaining_min", "confidence"} <= set(result.keys())

    def test_p25_le_p50_le_p75(self):
        result = survival_estimate(_DURATIONS_30, elapsed=60)
        assert result["optimistic_remaining_min"] <= result["median_remaining_min"]
        assert result["median_remaining_min"] <= result["pessimistic_remaining_min"]

    def test_correct_p50_value(self):
        # durations > 60: [70,80,...,350] = 29 items
        # remaining: [10,20,...,290]
        # p50 = index 14 → 150
        result = survival_estimate(_DURATIONS_30, elapsed=60)
        still = sorted([d - 60 for d in _DURATIONS_30 if d > 60])
        p50 = still[int(len(still) * 0.50)]
        assert result["median_remaining_min"] == pytest.approx(p50)

    def test_correct_p25_value(self):
        result = survival_estimate(_DURATIONS_30, elapsed=60)
        still = sorted([d - 60 for d in _DURATIONS_30 if d > 60])
        p25 = still[int(len(still) * 0.25)]
        assert result["optimistic_remaining_min"] == pytest.approx(max(p25, 5))

    def test_correct_p75_value(self):
        result = survival_estimate(_DURATIONS_30, elapsed=60)
        still = sorted([d - 60 for d in _DURATIONS_30 if d > 60])
        p75 = still[int(len(still) * 0.75)]
        assert result["pessimistic_remaining_min"] == pytest.approx(p75)

    def test_high_confidence_when_30_still_going(self):
        # elapsed=0 → all 30 durations still going
        result = survival_estimate(_DURATIONS_30, elapsed=0)
        assert result["confidence"] == "high"

    def test_medium_confidence_when_5_to_29_still_going(self):
        # elapsed=250: durations > 250 in _DURATIONS_30 are [260,270,...,350]=10 items
        result = survival_estimate(_DURATIONS_30, elapsed=250)
        assert result["confidence"] == "medium"

    def test_sparse_fallback_when_lt5_still_going(self):
        result = survival_estimate(_DURATIONS_SPARSE, elapsed=60)
        assert result["confidence"] == "low"
        assert result["median_remaining_min"] == 30
        assert result["optimistic_remaining_min"] == 10
        assert result["pessimistic_remaining_min"] == 120

    def test_optimistic_never_below_5(self):
        # elapsed very close to all durations → p25 may be tiny
        durations = [61, 62, 63, 64, 65, 66, 67, 68, 69, 70] * 3  # 30 items, all ~60-70
        result = survival_estimate(durations, elapsed=60)
        assert result["optimistic_remaining_min"] >= 5

    def test_elapsed_zero_uses_full_distribution(self):
        result = survival_estimate(_DURATIONS_20, elapsed=0)
        # All 20 still going, p50 = index 10 = value at 60+10*10=160
        still = sorted(_DURATIONS_20)
        p50 = still[int(len(still) * 0.50)]
        assert result["median_remaining_min"] == pytest.approx(p50)


# ── fallback_estimate ─────────────────────────────────────────────────────────

class TestFallbackEstimate:
    def _initial(self, min_h=1.0, median_h=3.0, max_h=6.0):
        return {"min": min_h, "median": median_h, "max": max_h}

    def test_returns_required_keys(self):
        result = fallback_estimate(self._initial(), elapsed_hours=0.0)
        assert {"optimistic_remaining_min", "median_remaining_min",
                "pessimistic_remaining_min", "confidence"} <= set(result.keys())

    def test_confidence_is_low(self):
        result = fallback_estimate(self._initial(), elapsed_hours=0.0)
        assert result["confidence"] == "low"

    def test_elapsed_zero_returns_full_initial(self):
        result = fallback_estimate(self._initial(1.0, 3.0, 6.0), elapsed_hours=0.0)
        assert result["median_remaining_min"] == pytest.approx(180)  # 3h
        assert result["optimistic_remaining_min"] == pytest.approx(60)  # 1h
        assert result["pessimistic_remaining_min"] == pytest.approx(360)  # 6h

    def test_elapsed_subtracts_from_estimate(self):
        result = fallback_estimate(self._initial(1.0, 3.0, 6.0), elapsed_hours=1.0)
        assert result["median_remaining_min"] == pytest.approx(120)  # 3h - 1h = 2h

    def test_optimistic_floor_at_5(self):
        # elapsed=2h, min=1h → 1h - 2h = -60 → floor at 5
        result = fallback_estimate(self._initial(min_h=1.0, median_h=3.0, max_h=6.0),
                                   elapsed_hours=2.0)
        assert result["optimistic_remaining_min"] >= 5

    def test_median_floor_at_10(self):
        # elapsed > median → floor at 10
        result = fallback_estimate(self._initial(1.0, 2.0, 6.0), elapsed_hours=3.0)
        assert result["median_remaining_min"] >= 10

    def test_pessimistic_floor_at_15(self):
        result = fallback_estimate(self._initial(1.0, 2.0, 3.0), elapsed_hours=5.0)
        assert result["pessimistic_remaining_min"] >= 15


# ── estimate_remaining ────────────────────────────────────────────────────────

class TestEstimateRemaining:
    def _base(self, **kwargs):
        defaults = dict(
            outage_type="rationing",
            region="maracaibo",
            initial_estimate_hours={"min": 2.0, "median": 4.0, "max": 6.0},
            elapsed_minutes=60.0,
            crowd_restoration_reports=0,
            inet_recovering=False,
            historical_durations=_DURATIONS_30,
            now=NOW,
        )
        defaults.update(kwargs)
        return defaults

    def test_returns_required_keys(self):
        result = estimate_remaining(**self._base())
        assert {"elapsed_minutes", "estimated_remaining_min",
                "estimated_remaining_range_min", "estimated_restoration_time",
                "confidence", "message", "confidence_boost"} <= set(result.keys())

    def test_elapsed_minutes_in_output(self):
        result = estimate_remaining(**self._base(elapsed_minutes=90.0))
        assert result["elapsed_minutes"] == 90

    def test_range_keys_present(self):
        result = estimate_remaining(**self._base())
        r = result["estimated_remaining_range_min"]
        assert {"optimistic", "likely", "pessimistic"} == set(r.keys())

    def test_uses_survival_when_20_plus_durations(self):
        # 30 durations → survival path; elapsed=60 → durations >60 = 29
        result = estimate_remaining(**self._base(
            historical_durations=_DURATIONS_30, elapsed_minutes=60.0
        ))
        still = sorted([d - 60 for d in _DURATIONS_30 if d > 60])
        p50 = still[int(len(still) * 0.50)]
        assert result["estimated_remaining_min"] == round(p50)

    def test_uses_fallback_when_lt20_durations(self):
        result = estimate_remaining(**self._base(
            historical_durations=[60, 90, 120],  # < 20
            elapsed_minutes=30.0,
        ))
        # fallback: median=4h=240min, elapsed=30min → 210 remaining
        assert result["estimated_remaining_min"] == 210

    def test_crowd_restoration_reduces_median(self):
        r_no_crowd = estimate_remaining(**self._base(crowd_restoration_reports=0))
        r_crowd    = estimate_remaining(**self._base(crowd_restoration_reports=3))
        assert r_crowd["estimated_remaining_min"] < r_no_crowd["estimated_remaining_min"]

    def test_crowd_restoration_multiplier_60pct(self):
        # With survival path, check 0.6 multiplier applied
        r_no = estimate_remaining(**self._base(crowd_restoration_reports=0))
        r_cr = estimate_remaining(**self._base(crowd_restoration_reports=5))
        ratio = r_cr["estimated_remaining_min"] / r_no["estimated_remaining_min"]
        assert ratio == pytest.approx(0.6, abs=0.05)

    def test_inet_recovering_reduces_median(self):
        r_no_inet = estimate_remaining(**self._base(inet_recovering=False))
        r_inet    = estimate_remaining(**self._base(inet_recovering=True))
        assert r_inet["estimated_remaining_min"] < r_no_inet["estimated_remaining_min"]

    def test_inet_recovering_multiplier_70pct(self):
        r_no = estimate_remaining(**self._base(inet_recovering=False))
        r_in = estimate_remaining(**self._base(inet_recovering=True))
        ratio = r_in["estimated_remaining_min"] / r_no["estimated_remaining_min"]
        assert ratio == pytest.approx(0.7, abs=0.05)

    def test_over_max_sets_longer_than_expected(self):
        # max=6h=360min, elapsed=400 > 360
        result = estimate_remaining(**self._base(
            elapsed_minutes=400.0,
            historical_durations=_DURATIONS_30,
        ))
        assert result.get("status") == "longer_than_expected"

    def test_within_max_no_status_flag(self):
        result = estimate_remaining(**self._base(elapsed_minutes=60.0))
        assert result.get("status") != "longer_than_expected"

    def test_restoration_time_after_now(self):
        result = estimate_remaining(**self._base())
        eta_str = result["estimated_restoration_time"]
        eta = datetime.fromisoformat(eta_str)
        assert eta > NOW

    def test_confidence_boost_set_on_crowd(self):
        result = estimate_remaining(**self._base(crowd_restoration_reports=4))
        assert result["confidence_boost"] != ""

    def test_confidence_boost_set_on_inet(self):
        result = estimate_remaining(**self._base(inet_recovering=True))
        assert result["confidence_boost"] != ""

    def test_confidence_boost_empty_no_signals(self):
        result = estimate_remaining(**self._base(
            crowd_restoration_reports=0, inet_recovering=False
        ))
        assert result["confidence_boost"] == ""
