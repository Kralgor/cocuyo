"""
Tests for pipeline/restoration_tracker.py.
Offline — pure function, all time injected.
"""
import pytest
from datetime import datetime, timedelta, timezone

from pipeline.restoration_tracker import check_restoration, RESTORATION_THRESHOLDS

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
OUTAGE_START = NOW - timedelta(hours=2)
RECENT_FLUCTUATION = NOW - timedelta(minutes=5)    # within stability window
OLD_FLUCTUATION    = NOW - timedelta(minutes=20)   # outside stability window


def _call(
    region="maracaibo",
    current_inet_score=0.9,
    baseline_inet_score=1.0,
    crowd_power_back_reports=0,
    crowd_power_back_first_at=None,
    last_fluctuation_at=None,
    outage_start=OUTAGE_START,
    now=NOW,
):
    return check_restoration(
        region=region,
        outage_start=outage_start,
        current_inet_score=current_inet_score,
        baseline_inet_score=baseline_inet_score,
        crowd_power_back_reports=crowd_power_back_reports,
        crowd_power_back_first_at=crowd_power_back_first_at,
        last_fluctuation_at=last_fluctuation_at,
        now=now,
    )


# ── still_out ─────────────────────────────────────────────────────────────────

class TestStillOut:
    def test_no_signals_returns_still_out(self):
        result = _call(current_inet_score=0.2, crowd_power_back_reports=0)
        assert result["status"] == "still_out"

    def test_still_out_has_empty_signals(self):
        result = _call(current_inet_score=0.0, crowd_power_back_reports=0)
        assert result["signals"] == []

    def test_zero_baseline_inet_no_signal(self):
        # baseline=0 → recovery_ratio=0 → no inet signal
        result = _call(current_inet_score=0.9, baseline_inet_score=0.0,
                       crowd_power_back_reports=0)
        assert result["status"] == "still_out"

    def test_below_crowd_threshold_no_crowd_signal(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(crowd_power_back_reports=threshold - 1,
                       current_inet_score=0.2)
        assert result["status"] == "still_out"


# ── recovering ────────────────────────────────────────────────────────────────

class TestRecovering:
    def test_inet_recovered_but_unstable_returns_recovering(self):
        # inet OK, but recent fluctuation → no stable signal → 1 signal only
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert result["status"] == "recovering"

    def test_crowd_confirmed_but_unstable_returns_recovering(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            crowd_power_back_reports=threshold,
            current_inet_score=0.1,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert result["status"] == "recovering"

    def test_recovering_confidence_is_low(self):
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert result["confidence"] == "low"

    def test_recovering_has_message(self):
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert isinstance(result.get("message"), str)
        assert len(result["message"]) > 0

    def test_recovering_signals_list_not_empty(self):
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert len(result["signals"]) >= 1

    def test_only_crowd_no_inet_recovering(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            crowd_power_back_reports=threshold,
            current_inet_score=0.1, baseline_inet_score=1.0,
            last_fluctuation_at=RECENT_FLUCTUATION,
        )
        assert result["status"] == "recovering"


# ── restored ──────────────────────────────────────────────────────────────────

class TestRestored:
    def test_inet_recovered_stable_no_fluctuation_returns_restored(self):
        result = _call(current_inet_score=0.9, baseline_inet_score=1.0)
        assert result["status"] == "restored"

    def test_crowd_confirmed_stable_no_fluctuation_returns_restored(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            crowd_power_back_reports=threshold,
            current_inet_score=0.1, baseline_inet_score=1.0,
        )
        assert result["status"] == "restored"

    def test_old_fluctuation_does_not_block_stability(self):
        # 20 min ago > 15 min threshold → stable
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=OLD_FLUCTUATION,
        )
        assert result["status"] == "restored"

    def test_three_signals_high_confidence(self):
        # inet + crowd + stable = 3 signals
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            crowd_power_back_reports=threshold,
        )
        assert result["confidence"] == "high"

    def test_two_signals_medium_confidence(self):
        # inet + stable = 2 signals (no crowd)
        result = _call(current_inet_score=0.9, baseline_inet_score=1.0,
                       crowd_power_back_reports=0)
        assert result["confidence"] == "medium"

    def test_restored_at_uses_crowd_power_back_first_at(self):
        first_at = NOW - timedelta(minutes=10)
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            crowd_power_back_reports=threshold,
            crowd_power_back_first_at=first_at,
        )
        assert result["status"] == "restored"
        restored_dt = datetime.fromisoformat(result["restored_at"])
        assert abs((restored_dt - first_at).total_seconds()) < 1

    def test_restored_at_falls_back_to_now(self):
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            crowd_power_back_first_at=None,
        )
        assert result["status"] == "restored"
        restored_dt = datetime.fromisoformat(result["restored_at"])
        assert abs((restored_dt - NOW).total_seconds()) < 1

    def test_duration_minutes_correct(self):
        # outage_start = NOW - 2h = 120 min
        result = _call(current_inet_score=0.9, baseline_inet_score=1.0,
                       crowd_power_back_first_at=None)
        assert result["outage_duration_minutes"] == 120

    def test_duration_uses_crowd_first_at_not_now(self):
        first_at = NOW - timedelta(minutes=10)  # 10 min before now → 120-10=110 min
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            crowd_power_back_reports=threshold,
            crowd_power_back_first_at=first_at,
        )
        expected = round((first_at - OUTAGE_START).total_seconds() / 60)
        assert result["outage_duration_minutes"] == expected

    def test_restored_signals_contains_stable(self):
        result = _call(current_inet_score=0.9, baseline_inet_score=1.0)
        assert "stable" in result["signals"]


# ── thresholds ────────────────────────────────────────────────────────────────

class TestThresholds:
    def test_inet_at_exactly_threshold_triggers(self):
        ratio = RESTORATION_THRESHOLDS["inet_recovery_ratio"]
        result = _call(
            current_inet_score=ratio * 1.0,
            baseline_inet_score=1.0,
        )
        assert result["status"] == "restored"

    def test_inet_just_below_threshold_no_inet_signal(self):
        ratio = RESTORATION_THRESHOLDS["inet_recovery_ratio"]
        result = _call(
            current_inet_score=ratio * 0.99,
            baseline_inet_score=1.0,
            crowd_power_back_reports=0,
        )
        assert result["status"] == "still_out"

    def test_crowd_at_exact_threshold_triggers(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            crowd_power_back_reports=threshold,
            current_inet_score=0.1,
        )
        assert result["status"] == "restored"

    def test_crowd_one_below_threshold_no_crowd_signal(self):
        threshold = RESTORATION_THRESHOLDS["crowd_reports_power_back"]
        result = _call(
            crowd_power_back_reports=threshold - 1,
            current_inet_score=0.1,
        )
        assert result["status"] == "still_out"

    def test_fluctuation_at_exactly_min_stable_minutes_is_stable(self):
        stable_min = RESTORATION_THRESHOLDS["min_stable_minutes"]
        fluctuation = NOW - timedelta(minutes=stable_min)
        result = _call(
            current_inet_score=0.9, baseline_inet_score=1.0,
            last_fluctuation_at=fluctuation,
        )
        assert result["status"] == "restored"
