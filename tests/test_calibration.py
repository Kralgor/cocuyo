"""
Tests for pipeline/calibration.py.
All offline — mock Supabase client.
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from pipeline.calibration import recalibrate_active_users, DEFAULT_MULTIPLIER

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)


def _client(rows):
    c = MagicMock()
    c.table.return_value.select.return_value.gte.return_value.execute.return_value = (
        MagicMock(data=rows)
    )
    return c


def _row(region="maracaibo", ip_hash="ip_a"):
    return {"region": region, "ip_hash": ip_hash}


# ── recalibrate_active_users ──────────────────────────────────────────────────

class TestRecalibrateActiveUsers:
    def test_empty_db_returns_empty_dict(self):
        result = recalibrate_active_users(_client([]), now=NOW)
        assert result == {}

    def test_single_region_single_reporter(self):
        result = recalibrate_active_users(_client([_row()]), now=NOW)
        assert result["maracaibo"] == 1 * DEFAULT_MULTIPLIER

    def test_three_distinct_ips_one_region(self):
        rows = [_row(ip_hash="ip_a"), _row(ip_hash="ip_b"), _row(ip_hash="ip_c")]
        result = recalibrate_active_users(_client(rows), now=NOW)
        assert result["maracaibo"] == 3 * DEFAULT_MULTIPLIER

    def test_duplicate_ips_counted_once(self):
        rows = [_row(ip_hash="ip_a"), _row(ip_hash="ip_a"), _row(ip_hash="ip_b")]
        result = recalibrate_active_users(_client(rows), now=NOW)
        assert result["maracaibo"] == 2 * DEFAULT_MULTIPLIER

    def test_multiple_regions_counted_separately(self):
        rows = [
            _row("maracaibo", "ip_a"),
            _row("maracaibo", "ip_b"),
            _row("caracas",   "ip_c"),
        ]
        result = recalibrate_active_users(_client(rows), now=NOW)
        assert result["maracaibo"] == 2 * DEFAULT_MULTIPLIER
        assert result["caracas"]   == 1 * DEFAULT_MULTIPLIER

    def test_ip_shared_across_regions_counted_per_region(self):
        # same ip_hash in two regions → counted once per region
        rows = [_row("maracaibo", "ip_shared"), _row("caracas", "ip_shared")]
        result = recalibrate_active_users(_client(rows), now=NOW)
        assert result["maracaibo"] == 1 * DEFAULT_MULTIPLIER
        assert result["caracas"]   == 1 * DEFAULT_MULTIPLIER

    def test_custom_multiplier(self):
        rows = [_row(ip_hash="ip_a"), _row(ip_hash="ip_b")]
        result = recalibrate_active_users(_client(rows), now=NOW, multiplier=5)
        assert result["maracaibo"] == 2 * 5

    def test_db_error_returns_empty(self):
        c = MagicMock()
        c.table.side_effect = Exception("DB down")
        result = recalibrate_active_users(c, now=NOW)
        assert result == {}

    def test_query_uses_30day_cutoff(self):
        c = _client([])
        recalibrate_active_users(c, now=NOW)
        # gte called with cutoff = NOW - 30 days
        expected_cutoff = (NOW - timedelta(days=30)).isoformat()
        c.table.return_value.select.return_value.gte.assert_called_once_with(
            "created_at", expected_cutoff
        )

    def test_returns_int_not_float(self):
        rows = [_row(ip_hash="ip_a")]
        result = recalibrate_active_users(_client(rows), now=NOW)
        assert isinstance(result["maracaibo"], int)

    def test_default_multiplier_is_10(self):
        assert DEFAULT_MULTIPLIER == 10
