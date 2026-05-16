"""
Tests for pipeline/outage_lifecycle.py. All offline — mock Supabase client.
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, call, patch

from pipeline.outage_lifecycle import (
    _close_outage,
    _create_active_outage,
    _fetch_active_outages,
    process_lifecycle,
)

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
STARTED = NOW - timedelta(hours=2)


# ── helpers ───────────────────────────────────────────────────────────────────

def _region(status="likely_outage", score=0.7, crowd=5):
    return {"status": status, "current_score": score, "crowd_reports_30min": crowd}


def _active_row(region="maracaibo", event_id=None, started=None):
    return {
        "region":      region,
        "event_id":    event_id or "evt-001",
        "started_at":  (started or STARTED).isoformat(),
        "outage_type": None,
        "last_score":  0.8,
        "predicted_dur": None,
    }


def _client(active_rows=None):
    c = MagicMock()
    c.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=active_rows or []
    )
    c.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    c.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return c


# ── _fetch_active_outages ─────────────────────────────────────────────────────

class TestFetchActiveOutages:
    def test_empty_returns_empty_dict(self):
        result = _fetch_active_outages(_client([]))
        assert result == {}

    def test_keyed_by_region(self):
        rows = [_active_row("maracaibo"), _active_row("caracas")]
        result = _fetch_active_outages(_client(rows))
        assert set(result.keys()) == {"maracaibo", "caracas"}

    def test_db_error_returns_empty(self):
        c = MagicMock()
        c.table.side_effect = Exception("DB down")
        assert _fetch_active_outages(c) == {}


# ── process_lifecycle — new outages ───────────────────────────────────────────

class TestNewOutages:
    def test_outage_status_creates_active_row(self):
        c = _client([])
        regions = {"maracaibo": _region("likely_outage")}
        result = process_lifecycle(regions, NOW, c)
        assert "maracaibo" in result["new_outages"]
        c.table.return_value.insert.assert_called()

    def test_confirmed_outage_also_creates_row(self):
        c = _client([])
        regions = {"caracas": _region("confirmed_outage")}
        result = process_lifecycle(regions, NOW, c)
        assert "caracas" in result["new_outages"]

    def test_normal_status_no_new_outage(self):
        c = _client([])
        regions = {"maracaibo": _region("normal")}
        result = process_lifecycle(regions, NOW, c)
        assert result["new_outages"] == []

    def test_unverified_reports_no_outage(self):
        c = _client([])
        regions = {"maracaibo": _region("unverified_reports")}
        result = process_lifecycle(regions, NOW, c)
        assert result["new_outages"] == []

    def test_already_active_not_duplicated(self):
        existing = _active_row("maracaibo")
        c = _client([existing])
        regions = {"maracaibo": _region("likely_outage")}
        result = process_lifecycle(regions, NOW, c)
        assert result["new_outages"] == []
        c.table.return_value.insert.assert_not_called()


# ── process_lifecycle — event_id assignment ───────────────────────────────────

class TestEventIdAssignment:
    def test_single_region_gets_unique_event_id(self):
        inserted_payloads = []
        c = _client([])
        c.table.return_value.insert.side_effect = lambda p: (
            inserted_payloads.append(p) or MagicMock()
        )
        regions = {"maracaibo": _region("likely_outage")}
        process_lifecycle(regions, NOW, c)
        assert len(inserted_payloads) == 1
        assert "event_id" in inserted_payloads[0]

    def test_multi_region_same_cycle_share_event_id(self):
        inserted_payloads = []

        def capture_insert(payload):
            inserted_payloads.append(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock(data=[])
            return m

        c = _client([])
        c.table.return_value.insert.side_effect = capture_insert

        regions = {
            "maracaibo": _region("likely_outage"),
            "caracas":   _region("confirmed_outage"),
        }
        process_lifecycle(regions, NOW, c)

        assert len(inserted_payloads) == 2
        event_ids = [p["event_id"] for p in inserted_payloads]
        assert event_ids[0] == event_ids[1]

    def test_two_single_region_cycles_different_event_ids(self):
        ids = []

        def capture(payload):
            ids.append(payload["event_id"])
            m = MagicMock()
            m.execute.return_value = MagicMock(data=[])
            return m

        c1 = _client([])
        c1.table.return_value.insert.side_effect = capture
        process_lifecycle({"maracaibo": _region("likely_outage")}, NOW, c1)

        c2 = _client([])
        c2.table.return_value.insert.side_effect = capture
        process_lifecycle({"caracas": _region("likely_outage")}, NOW, c2)

        assert ids[0] != ids[1]


# ── process_lifecycle — restorations ─────────────────────────────────────────

class TestRestorations:
    def test_normal_status_closes_active_outage(self):
        existing = _active_row("maracaibo")
        c = _client([existing])
        regions = {"maracaibo": _region("normal", score=0.1)}
        result = process_lifecycle(regions, NOW, c)
        assert "maracaibo" in result["restorations"]

    def test_restoration_inserts_outage_history(self):
        existing = _active_row("maracaibo")
        c = _client([existing])
        regions = {"maracaibo": _region("normal")}
        process_lifecycle(regions, NOW, c)
        # history insert + active delete both called
        assert c.table.return_value.insert.called
        assert c.table.return_value.delete.called

    def test_duration_min_correct(self):
        captured = []

        def capture_insert(payload):
            captured.append(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock(data=[])
            return m

        start = NOW - timedelta(hours=3)
        existing = _active_row("maracaibo", started=start)
        c = _client([existing])
        c.table.return_value.insert.side_effect = capture_insert

        regions = {"maracaibo": _region("normal")}
        process_lifecycle(regions, NOW, c)

        history_payload = captured[0]
        assert history_payload["duration_min"] == 180

    def test_day_of_week_and_hour_correct(self):
        captured = []

        def capture_insert(payload):
            captured.append(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock(data=[])
            return m

        # STARTED = NOW - 2h = 2026-05-16 12:00 UTC, Saturday = weekday 5
        existing = _active_row("maracaibo", started=STARTED)
        c = _client([existing])
        c.table.return_value.insert.side_effect = capture_insert

        regions = {"maracaibo": _region("normal")}
        process_lifecycle(regions, NOW, c)

        h = captured[0]
        assert h["hour_started"] == STARTED.hour
        assert h["day_of_week"]  == STARTED.weekday()

    def test_event_id_preserved_in_history(self):
        captured = []

        def capture_insert(payload):
            captured.append(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock(data=[])
            return m

        existing = _active_row("maracaibo", event_id="shared-uuid")
        c = _client([existing])
        c.table.return_value.insert.side_effect = capture_insert

        process_lifecycle({"maracaibo": _region("normal")}, NOW, c)
        assert captured[0]["event_id"] == "shared-uuid"

    def test_likely_outage_continuing_not_restored(self):
        existing = _active_row("maracaibo")
        c = _client([existing])
        regions = {"maracaibo": _region("likely_outage")}
        result = process_lifecycle(regions, NOW, c)
        assert result["restorations"] == []

    def test_db_error_on_close_does_not_crash(self):
        existing = _active_row("maracaibo")
        c = _client([existing])
        c.table.return_value.insert.side_effect = Exception("DB error")
        # Should not raise
        process_lifecycle({"maracaibo": _region("normal")}, NOW, c)


# ── process_lifecycle — return shape ─────────────────────────────────────────

class TestReturnShape:
    def test_empty_regions_returns_empty_lists(self):
        result = process_lifecycle({}, NOW, _client([]))
        assert result == {"new_outages": [], "restorations": []}

    def test_no_transitions_returns_empty_lists(self):
        regions = {"maracaibo": _region("normal")}
        result = process_lifecycle(regions, NOW, _client([]))
        assert result["new_outages"] == []
        assert result["restorations"] == []
