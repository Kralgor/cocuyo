"""
Tests for pipeline/cross_validation.py. All offline — no Supabase calls.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, call

from pipeline.cross_validation import backfill_confirmed_by_passive, cross_validate

NOW = datetime(2026, 5, 16, 12, 0, 0, tzinfo=timezone.utc)


# ── cross_validate ────────────────────────────────────────────────────────────

class TestCrossValidateCase1:
    """All three signals say outage."""

    def test_returns_power_outage_confidence(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.9, 0.7)
        assert r["confidence"] == "very_high"
        assert r["trust_crowd"] is True

    def test_final_score_is_max(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.9, 0.7)
        assert r["final_score"] == pytest.approx(0.9)

    def test_no_manipulation_flag(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.9, 0.7)
        assert "flag" not in r

    def test_exact_boundary_all_0_5(self):
        r = cross_validate("caracas", 0.5, "medium", 0.5, 0.5)
        assert r["confidence"] == "very_high"


class TestCrossValidateCase2:
    """All three signals say normal."""

    def test_returns_high_confidence(self):
        r = cross_validate("maracaibo", 0.1, "low", 0.05, 0.0)
        assert r["confidence"] == "high"
        assert r["trust_crowd"] is True

    def test_final_score_is_average(self):
        r = cross_validate("caracas", 0.0, "low", 0.0, 0.0)
        assert r["final_score"] == pytest.approx(0.0)

    def test_no_flag(self):
        r = cross_validate("caracas", 0.1, "low", 0.1, 0.0)
        assert "flag" not in r


class TestCrossValidateCase3:
    """Crowd says outage, passive says no — possible manipulation."""

    def test_flag_present(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.1, 0.0)
        assert r.get("flag") == "possible_manipulation"

    def test_trust_crowd_false(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.1, 0.0)
        assert r["trust_crowd"] is False

    def test_score_dampened_70pct(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.1, 0.0)
        assert r["final_score"] == pytest.approx(0.8 * 0.3)

    def test_confidence_low(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.1, 0.0)
        assert r["confidence"] == "low"

    def test_boundary_crowd_exactly_0_5(self):
        r = cross_validate("barquisimeto", 0.5, "medium", 0.49, 0.49)
        assert r.get("flag") == "possible_manipulation"

    def test_none_passive_treated_as_zero(self):
        r = cross_validate("valencia", 0.8, "high", None, None)
        assert r.get("flag") == "possible_manipulation"


class TestCrossValidateCase4:
    """Passive says outage, crowd silent — users offline."""

    def test_trust_crowd_false(self):
        r = cross_validate("maracaibo", 0.1, "low", 0.9, 0.8)
        assert r["trust_crowd"] is False

    def test_final_score_is_passive_avg(self):
        r = cross_validate("maracaibo", 0.1, "low", 0.9, 0.7)
        assert r["final_score"] == pytest.approx((0.9 + 0.7) / 2)

    def test_confidence_medium(self):
        r = cross_validate("maracaibo", 0.1, "low", 0.9, 0.8)
        assert r["confidence"] == "medium"

    def test_inet_only_triggers_case4(self):
        r = cross_validate("cumana", 0.1, "low", 0.9, 0.0)
        assert r["trust_crowd"] is False
        assert r["confidence"] == "medium"

    def test_sat_only_triggers_case4(self):
        r = cross_validate("cumana", 0.1, "low", 0.0, 0.9)
        assert r["trust_crowd"] is False
        assert r["confidence"] == "medium"


class TestCrossValidateCase5:
    """Two of three agree — mixed signals."""

    def test_crowd_and_inet_agree(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.7, 0.1)
        assert r["confidence"] == "medium"
        assert r["trust_crowd"] is True

    def test_crowd_and_sat_agree(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.1, 0.7)
        assert r["confidence"] == "medium"
        assert r["trust_crowd"] is True

    def test_inet_and_sat_agree_crowd_no(self):
        r = cross_validate("maracaibo", 0.1, "low", 0.8, 0.7)
        assert r["confidence"] == "medium"
        assert r["trust_crowd"] is False

    def test_final_score_is_avg_of_agreeing(self):
        r = cross_validate("maracaibo", 0.8, "high", 0.6, 0.1)
        # crowd + inet agree; avg = (0.8+0.6)/2
        assert r["final_score"] == pytest.approx((0.8 + 0.6) / 2)


# ── backfill_confirmed_by_passive ─────────────────────────────────────────────

def _mock_client(updated_count: int = 3) -> MagicMock:
    client = MagicMock()
    chain  = client.table.return_value
    chain  = chain.update.return_value
    chain  = chain.eq.return_value
    chain  = chain.eq.return_value
    chain  = chain.gte.return_value
    chain.execute.return_value = MagicMock(data=[{}] * updated_count)
    return client


class TestBackfillConfirmedByPassive:
    def test_returns_count_updated(self):
        count = backfill_confirmed_by_passive("maracaibo", _mock_client(5), now=NOW)
        assert count == 5

    def test_zero_when_no_rows(self):
        count = backfill_confirmed_by_passive("caracas", _mock_client(0), now=NOW)
        assert count == 0

    def test_calls_correct_table(self):
        client = _mock_client()
        backfill_confirmed_by_passive("maracaibo", client, now=NOW)
        client.table.assert_called_once_with("outage_reports")

    def test_updates_confirmed_by_passive_true(self):
        client = _mock_client()
        backfill_confirmed_by_passive("maracaibo", client, now=NOW)
        client.table.return_value.update.assert_called_once_with(
            {"confirmed_by_passive": True}
        )

    def test_filters_by_region(self):
        client = _mock_client()
        backfill_confirmed_by_passive("maracaibo", client, now=NOW)
        eq_calls = client.table.return_value.update.return_value.eq.call_args_list
        assert call("region", "maracaibo") in eq_calls

    def test_filters_by_no_power_status(self):
        client = _mock_client()
        backfill_confirmed_by_passive("maracaibo", client, now=NOW)
        eq_calls = (
            client.table.return_value
            .update.return_value
            .eq.return_value
            .eq.call_args_list
        )
        assert call("status", "no_power") in eq_calls

    def test_supabase_error_returns_zero(self):
        client = MagicMock()
        client.table.side_effect = Exception("DB error")
        count = backfill_confirmed_by_passive("maracaibo", client, now=NOW)
        assert count == 0
