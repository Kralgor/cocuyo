"""
Tests for Phase 2 integration in pipeline/main.py.
Verifies lifecycle is called when phase >= 2 and supabase client available.
"""
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)


def _mock_supabase():
    c = MagicMock()
    c.table.return_value.select.return_value.gte.return_value.execute.return_value = MagicMock(data=[])
    c.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])
    c.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    c.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return c


class TestLifecycleWiredIntoRun:
    def test_lifecycle_called_phase2(self):
        """process_lifecycle must be called once per cycle when phase >= 2."""
        mock_client = _mock_supabase()

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle") as mock_lc, \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            run(now=NOW)

        mock_lc.assert_called_once()

    def test_lifecycle_not_called_phase1(self):
        """Phase 1: no lifecycle DB writes."""
        mock_client = _mock_supabase()

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main.process_lifecycle") as mock_lc, \
             patch.dict(os.environ, {"COCUYO_PHASE": "1"}):
            from pipeline.main import run
            run(now=NOW)

        mock_lc.assert_not_called()

    def test_lifecycle_receives_region_scores(self):
        """Lifecycle must get the scored region dict (for transition detection)."""
        mock_client = _mock_supabase()
        captured = []

        def capture(regions_scored, now, client):
            captured.append(regions_scored)
            return {"new_outages": [], "restorations": []}

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle", side_effect=capture), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            from pipeline.regions import REGIONS
            run(now=NOW)

        assert len(captured) == 1
        assert set(captured[0].keys()) == set(REGIONS.keys())

    def test_lifecycle_receives_supabase_client(self):
        """Lifecycle must get the same client used for crowd reports."""
        mock_client = _mock_supabase()
        received_client = []

        def capture(regions_scored, now, client):
            received_client.append(client)
            return {"new_outages": [], "restorations": []}

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle", side_effect=capture), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            run(now=NOW)

        assert received_client[0] is mock_client

    def test_lifecycle_skipped_when_client_unavailable(self):
        """If supabase_client is None (DB failure), lifecycle not called."""
        with patch("pipeline.main._create_supabase_client",
                   side_effect=Exception("no creds")), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle") as mock_lc, \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            run(now=NOW)

        mock_lc.assert_not_called()

    def test_lifecycle_failure_does_not_crash_run(self):
        """DB error in lifecycle must not abort the cycle."""
        mock_client = _mock_supabase()

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle",
                   side_effect=Exception("lifecycle boom")), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            result = run(now=NOW)

        assert "regions" in result


class TestSatelliteSignalInSchema:
    """Satellite field present in every region, null when no VIIRS data."""

    def test_satellite_key_present_phase2(self):
        mock_client = _mock_supabase()

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle",
                   return_value={"new_outages": [], "restorations": []}), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            from pipeline.regions import REGIONS
            doc = run(now=NOW)

        for key in REGIONS:
            assert "satellite" in doc["regions"][key]["signals"], f"{key}: satellite missing"

    def test_satellite_null_when_viirs_empty(self):
        """No VIIRS granules → satellite=null for all regions."""
        mock_client = _mock_supabase()

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, {}, {}, 0)), \
             patch("pipeline.main.process_lifecycle",
                   return_value={"new_outages": [], "restorations": []}), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            from pipeline.regions import REGIONS
            doc = run(now=NOW)

        for key in REGIONS:
            assert doc["regions"][key]["signals"]["satellite"] is None, f"{key}: expected null"

    def test_satellite_score_passed_when_viirs_has_data(self):
        """VIIRS data present → satellite score wired to scorer."""
        mock_client = _mock_supabase()
        viirs = {"maracaibo": {"score": 0.85, "status": "major_outage"}}

        with patch("pipeline.main._create_supabase_client", return_value=mock_client), \
             patch("pipeline.main._fetch_passive_signals",
                   return_value=(None, viirs, {}, 0)), \
             patch("pipeline.main.process_lifecycle",
                   return_value={"new_outages": [], "restorations": []}), \
             patch.dict(os.environ, {"COCUYO_PHASE": "2"}):
            from pipeline.main import run
            doc = run(now=NOW)

        sat = doc["regions"]["maracaibo"]["signals"]["satellite"]
        assert sat == pytest.approx(0.85)
