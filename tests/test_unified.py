"""
Tests for pipeline/collector_internet_unified.py.

classify_internet_situation() is pure — tested directly with crafted inputs.
collect_all_internet_signals() tested with injected mock sessions.
All tests offline.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from pipeline.collector_internet_unified import (
    classify_internet_situation,
    collect_all_internet_signals,
)
from pipeline.collector_cloudflare import VE_ASNS

NOW = datetime(2026, 5, 16, 12, 0, 0, tzinfo=timezone.utc)

# ── input builders ────────────────────────────────────────────────────────────

def _ioda(scores: dict[str, float | None]) -> dict[str, dict]:
    """Build IODA result dict. scores keyed by full ASN string e.g. 'AS8048'."""
    providers = {"AS8048": "CANTV", "AS21826": "Inter", "AS264731": "Movistar VE", "AS22313": "Digitel"}
    return {
        asn: {"provider": providers.get(asn, "Unknown"), "score": score, "timestamp": 0}
        for asn, score in scores.items()
    }


def _ioda_all(score: float | None) -> dict:
    return _ioda({"AS8048": score, "AS21826": score, "AS264731": score, "AS22313": score})


def _cf(per_asn_detected: dict[str, bool], anomalies: list | None = None) -> dict:
    """Build cloudflare result dict. per_asn_detected keyed by plain ASN number."""
    return {
        "anomalies": anomalies or [],
        "per_asn": {
            asn: {"detected": detected}
            for asn, detected in per_asn_detected.items()
        },
    }


def _cf_all(detected: bool, anomalies: list | None = None) -> dict:
    return _cf({asn: detected for asn in VE_ASNS}, anomalies)


def _cf_anomaly(asn="8048") -> dict:
    return {"type": "OUTAGE", "asn": asn, "asn_name": "CANTV",
            "start": "2026-05-16T10:00:00Z", "end": None,
            "location": "VE", "visible_in_data_sources": []}


# ── classify_internet_situation ───────────────────────────────────────────────

class TestClassifyPowerOutage:
    def test_all_isps_dropping_high_ioda(self):
        result = classify_internet_situation(
            _ioda_all(0.20),   # all 4 below 0.7
            _cf_all(True),     # all 4 detected
            {},
        )
        assert result["situation"] == "power_outage"
        assert result["confidence"] == "high"

    def test_75pct_threshold_met(self):
        # 3 of 4 ISPs dropping on CF (75%), 3 on IODA -> power_outage
        ioda = _ioda({"AS8048": 0.2, "AS21826": 0.2, "AS264731": 0.2, "AS22313": 0.9})
        cf   = _cf({"8048": True, "21826": True, "264731": True, "22313": False})
        result = classify_internet_situation(ioda, cf, {})
        assert result["situation"] == "power_outage"

    def test_75pct_threshold_not_met(self):
        # 2 of 4 ISPs dropping on CF (50%) -> not power_outage
        ioda = _ioda({"AS8048": 0.2, "AS21826": 0.2, "AS264731": 0.9, "AS22313": 0.9})
        cf   = _cf({"8048": True, "21826": True, "264731": False, "22313": False})
        result = classify_internet_situation(ioda, cf, {})
        assert result["situation"] != "power_outage"

    def test_internet_score_is_high(self):
        result = classify_internet_situation(_ioda_all(0.1), _cf_all(True), {})
        assert result["internet_score"] == pytest.approx(0.95)

    def test_requires_at_least_2_ioda_drops(self):
        # All CF dropping but only 1 IODA drop -> not power_outage
        ioda = _ioda({"AS8048": 0.2, "AS21826": 0.9, "AS264731": 0.9, "AS22313": 0.9})
        result = classify_internet_situation(ioda, _cf_all(True), {})
        assert result["situation"] != "power_outage"


class TestClassifyIspFailure:
    def test_single_isp_drop(self):
        ioda = _ioda({"AS8048": 0.5, "AS21826": 0.95, "AS264731": 0.95, "AS22313": 0.95})
        cf   = _cf({"8048": True, "21826": False, "264731": False, "22313": False})
        result = classify_internet_situation(ioda, cf, {})
        assert result["situation"] == "isp_failure"
        assert result["confidence"] == "medium"

    def test_affected_isp_name(self):
        cf = _cf({"8048": True, "21826": False, "264731": False, "22313": False})
        result = classify_internet_situation(_ioda_all(0.95), cf, {})
        assert result["affected_isp"] == "CANTV"

    def test_inter_identified(self):
        cf = _cf({"8048": False, "21826": True, "264731": False, "22313": False})
        result = classify_internet_situation(_ioda_all(0.95), cf, {})
        assert result["situation"] == "isp_failure"
        assert result["affected_isp"] == "Inter"

    def test_internet_score_is_medium(self):
        cf = _cf({"8048": True, "21826": False, "264731": False, "22313": False})
        result = classify_internet_situation(_ioda_all(0.95), cf, {})
        assert result["internet_score"] == pytest.approx(0.40)


class TestClassifyConfirmedDisruption:
    def test_cf_outage_anomaly_present(self):
        result = classify_internet_situation(
            _ioda_all(0.95),
            _cf_all(False, anomalies=[_cf_anomaly()]),
            {},
        )
        assert result["situation"] == "confirmed_disruption"
        assert result["confidence"] == "high"

    def test_multiple_anomalies_in_detail(self):
        anomalies = [_cf_anomaly("8048"), _cf_anomaly("21826")]
        result = classify_internet_situation(_ioda_all(0.95), _cf_all(False, anomalies=anomalies), {})
        assert result["situation"] == "confirmed_disruption"
        assert len(result["anomalies"]) == 2

    def test_internet_score_is_0_70(self):
        result = classify_internet_situation(
            _ioda_all(0.95),
            _cf_all(False, anomalies=[_cf_anomaly()]),
            {},
        )
        assert result["internet_score"] == pytest.approx(0.70)

    def test_non_outage_anomaly_ignored(self):
        # type != "OUTAGE" -> should not trigger confirmed_disruption
        non_outage = {"type": "DEGRADATION", "asn": "8048", "asn_name": "CANTV",
                      "start": None, "end": None, "location": "VE",
                      "visible_in_data_sources": []}
        result = classify_internet_situation(_ioda_all(0.95), _cf_all(False, [non_outage]), {})
        assert result["situation"] == "normal"


class TestClassifyNormal:
    def test_all_clear(self):
        result = classify_internet_situation(_ioda_all(0.95), _cf_all(False), {})
        assert result["situation"] == "normal"
        assert result["confidence"] == "high"

    def test_internet_score_is_zero(self):
        result = classify_internet_situation(_ioda_all(0.95), _cf_all(False), {})
        assert result["internet_score"] == pytest.approx(0.0)

    def test_none_ioda_scores_treated_as_ok(self):
        # score=None -> not counted as dropping
        result = classify_internet_situation(_ioda_all(None), _cf_all(False), {})
        assert result["situation"] == "normal"

    def test_empty_per_asn(self):
        cf = {"anomalies": [], "per_asn": {}}
        result = classify_internet_situation(_ioda_all(0.95), cf, {})
        assert result["situation"] == "normal"


# ── collect_all_internet_signals ──────────────────────────────────────────────

class TestCollectAllInternetSignals:
    def _make_sessions(self, ioda_score=0.95, cf_detected=False):
        ioda_resp = MagicMock()
        ioda_resp.status_code = 200
        ioda_resp.raise_for_status.side_effect = None
        ioda_resp.json.return_value = {"data": [{"values": [ioda_score]}]}

        ioda_session = MagicMock()
        ioda_session.get.return_value = ioda_resp

        cf_resp = MagicMock()
        cf_resp.status_code = 200
        cf_resp.raise_for_status.side_effect = None

        def cf_json():
            url = cf_resp._mock_name or ""
            return {
                "result": {
                    "trafficAnomalies": [],
                    "httpRequests": {
                        "timestamps": [f"t{i}" for i in range(8)],
                        "values": [0.0 if cf_detected else 100.0] * 8,
                    },
                }
            }
        cf_resp.json.side_effect = cf_json

        cf_session = MagicMock()
        cf_session.get.return_value = cf_resp

        return ioda_session, cf_session

    def test_returns_required_keys(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert "timestamp" in result
        assert "ioda" in result
        assert "cloudflare" in result
        assert "ooni" in result
        assert "classification" in result

    def test_timestamp_matches_now(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert result["timestamp"] == NOW.isoformat()

    def test_ooni_is_empty(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert result["ooni"] == {}

    def test_classification_has_situation(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert "situation" in result["classification"]

    def test_internet_score_in_classification(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert "internet_score" in result["classification"]

    def test_all_four_asns_in_cloudflare_per_asn(self):
        ioda_s, cf_s = self._make_sessions()
        result = collect_all_internet_signals(
            now=NOW, _ioda_session=ioda_s, _cf_session=cf_s
        )
        assert set(result["cloudflare"]["per_asn"].keys()) == set(VE_ASNS.keys())
