"""
Phase 1 pipeline integration test.

Feeds synthetic crowd reports through the full chain:
  validation → quorum → scorer → status.json shape

No Supabase, no R2, no external APIs — all in-memory.
Calls pipeline.main.score_region() and build_status_json() directly.
"""

import pytest
from datetime import datetime, timedelta, timezone

from pipeline.main import score_region, build_status_json
from pipeline.regions import REGIONS
from pipeline.validation import ReportValidator

NOW = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
REGION = "maracaibo"  # representative region used in per-region tests

_TOP_KEYS = {"updated_at", "phase", "scheduler", "next_update_approx", "collector_errors", "regions"}
_REGION_KEYS = {
    "display_name", "current_score", "prediction_score",
    "status", "signals", "crowd_reports_30min", "prediction_text", "rationing_pattern",
}
_SIGNAL_KEYS = {"internet", "satellite", "crowdsource", "weather"}


# ── helpers ───────────────────────────────────────────────────────────────────

def make_report(
    region: str = REGION,
    status: str = "no_power",
    ip_hash: str = "hash_a",
    lat: float | None = 10.6427,
    lon: float | None = -71.6125,
    minutes_ago: int = 5,
) -> dict:
    return {
        "region": region,
        "status": status,
        "ip_hash": ip_hash,
        "lat": lat,
        "lon": lon,
        "created_at": NOW - timedelta(minutes=minutes_ago),
        "sub_zone": None,
        "device_fingerprint": None,
    }


def run_pipeline(reports_by_region: dict[str, list[dict]]) -> dict:
    """Score all 17 regions with given reports, return status.json dict."""
    validator = ReportValidator()
    region_output = {}
    for region_key in REGIONS:
        raw = reports_by_region.get(region_key, [])
        region_output[region_key] = score_region(region_key, raw, validator, NOW)
    return build_status_json(NOW, phase=1, collector_errors=0, regions=region_output)


# ── schema (tracer bullet) ────────────────────────────────────────────────────

class TestSchema:
    def test_top_level_keys_present(self):
        doc = run_pipeline({})
        assert _TOP_KEYS <= set(doc.keys())

    def test_phase_and_scheduler_correct(self):
        doc = run_pipeline({})
        assert doc["phase"] == 1
        assert doc["scheduler"] == "github-actions"
        assert doc["collector_errors"] == 0

    def test_all_17_regions_present(self):
        doc = run_pipeline({})
        assert set(doc["regions"].keys()) == set(REGIONS.keys())
        assert len(doc["regions"]) == 17

    def test_every_region_has_required_keys(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert _REGION_KEYS <= set(entry.keys()), f"{key}: missing keys"

    def test_every_region_has_all_signal_keys(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert set(entry["signals"].keys()) == _SIGNAL_KEYS, f"{key}: wrong signal keys"

    def test_passive_signals_null_phase_1(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert entry["signals"]["internet"]   is None, f"{key}: internet not null"
            assert entry["signals"]["satellite"]  is None, f"{key}: satellite not null"
            assert entry["signals"]["weather"]    is None, f"{key}: weather not null"

    def test_prediction_fields_always_null(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert entry["prediction_score"] is None, f"{key}: prediction_score not null"
            assert entry["prediction_text"]  is None, f"{key}: prediction_text not null"


# ── zero reports ──────────────────────────────────────────────────────────────

class TestZeroReports:
    def test_all_regions_no_data(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert entry["status"] == "no_data", f"{key}: expected no_data"

    def test_crowdsource_null_for_all(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert entry["signals"]["crowdsource"] is None, f"{key}: crowdsource not null"

    def test_crowd_reports_30min_zero_for_all(self):
        doc = run_pipeline({})
        for key, entry in doc["regions"].items():
            assert entry["crowd_reports_30min"] == 0, f"{key}: expected 0 reports"


# ── below quorum (2 reports, 2 unique IPs — needs 3 to meet count threshold) ─

class TestBelowQuorum:
    def _two_reports(self) -> list[dict]:
        return [make_report(ip_hash="ip_a"), make_report(ip_hash="ip_b")]

    def test_status_is_unverified_reports(self):
        doc = run_pipeline({REGION: self._two_reports()})
        assert doc["regions"][REGION]["status"] == "unverified_reports"

    def test_crowd_reports_count_correct(self):
        doc = run_pipeline({REGION: self._two_reports()})
        assert doc["regions"][REGION]["crowd_reports_30min"] == 2

    def test_crowd_score_present_but_dampened(self):
        # pre-quorum: (2.0 / 3) * 0.5 ≈ 0.333 — below 0.5
        doc = run_pipeline({REGION: self._two_reports()})
        crowd = doc["regions"][REGION]["signals"]["crowdsource"]
        assert crowd is not None
        assert crowd < 0.5

    def test_current_score_null_below_quorum(self):
        doc = run_pipeline({REGION: self._two_reports()})
        assert doc["regions"][REGION]["current_score"] is None

    def test_other_regions_unaffected(self):
        doc = run_pipeline({REGION: self._two_reports()})
        for key, entry in doc["regions"].items():
            if key != REGION:
                assert entry["status"] == "no_data", f"{key} should be no_data"


# ── validation rejects bad reports before they reach quorum ──────────────────

class TestValidationGate:
    def test_gps_outside_venezuela_excluded_from_count(self):
        valid = [make_report(ip_hash=f"ip_{i}") for i in range(3)]
        outside_ve = [make_report(lat=48.8, lon=2.3, ip_hash="ip_paris")]  # Paris
        doc = run_pipeline({REGION: valid + outside_ve})
        # rejected report must not appear in crowd_reports_30min
        assert doc["regions"][REGION]["crowd_reports_30min"] == 3

    def test_ip_rate_exceeded_excluded(self):
        # 6 reports from the same IP — all rejected after the hard limit
        spammer = [make_report(ip_hash="spam_ip") for _ in range(6)]
        legit   = [make_report(ip_hash="ip_a"), make_report(ip_hash="ip_b")]
        doc = run_pipeline({REGION: spammer + legit})
        # spammer's 6 rejected; only 2 legit counted
        assert doc["regions"][REGION]["crowd_reports_30min"] == 2


# ── above quorum (10 reports, 4 unique IPs) ───────────────────────────────────

class TestAboveQuorum:
    def _quorum_reports(self, status: str = "no_power", n: int = 10) -> list[dict]:
        return [make_report(status=status, ip_hash=f"ip_{i % 4}") for i in range(n)]

    def test_status_unverified_reports(self):
        doc = run_pipeline({REGION: self._quorum_reports()})
        assert doc["regions"][REGION]["status"] == "unverified_reports"

    def test_all_no_power_crowd_score_one(self):
        doc = run_pipeline({REGION: self._quorum_reports(status="no_power")})
        assert doc["regions"][REGION]["signals"]["crowdsource"] == pytest.approx(1.0)

    def test_all_power_back_crowd_score_zero(self):
        doc = run_pipeline({REGION: self._quorum_reports(status="power_back")})
        assert doc["regions"][REGION]["signals"]["crowdsource"] == pytest.approx(0.0)

    def test_full_score_range_reachable(self):
        out_doc  = run_pipeline({REGION: self._quorum_reports("no_power")})
        back_doc = run_pipeline({REGION: self._quorum_reports("power_back")})
        assert out_doc["regions"][REGION]["signals"]["crowdsource"]  == pytest.approx(1.0)
        assert back_doc["regions"][REGION]["signals"]["crowdsource"] == pytest.approx(0.0)

    def test_crowd_reports_count_correct(self):
        doc = run_pipeline({REGION: self._quorum_reports(n=10)})
        assert doc["regions"][REGION]["crowd_reports_30min"] == 10

    def test_current_score_null_no_passive_signals(self):
        # Phase 1: current_score stays null even with quorum met — no passive cross-validation
        doc = run_pipeline({REGION: self._quorum_reports()})
        assert doc["regions"][REGION]["current_score"] is None
