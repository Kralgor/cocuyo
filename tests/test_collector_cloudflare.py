"""
Tests for pipeline/collector_cloudflare.py. All offline — no real HTTP.
"""
import pytest
from unittest.mock import MagicMock

from pipeline.collector_cloudflare import (
    VE_ASNS,
    detect_outage_from_timeseries,
    fetch_traffic_anomalies,
    fetch_traffic_timeseries_by_asn,
)

# ── helpers ───────────────────────────────────────────────────────────────────

def _mock_resp(data: dict, status: int = 200) -> MagicMock:
    r = MagicMock()
    r.status_code = status
    r.json.return_value = data
    r.raise_for_status.side_effect = (
        None if status < 400 else Exception(f"HTTP {status}")
    )
    return r


def _session(resp) -> MagicMock:
    s = MagicMock()
    if isinstance(resp, Exception):
        s.get.side_effect = resp
    else:
        s.get.return_value = resp
    return s


def _ts(values: list, provider: str = "CANTV") -> dict:
    return {
        "asn":        "8048",
        "provider":   provider,
        "timestamps": [f"t{i}" for i in range(len(values))],
        "values":     values,
    }


# ── detect_outage_from_timeseries ─────────────────────────────────────────────

class TestDetectOutage:
    def test_60pct_drop_detected(self):
        # baseline=100, recent=35 -> ratio=0.35 < 0.4 -> detected
        vals = [100.0] * 6 + [35.0, 35.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is True

    def test_exact_60pct_drop_detected(self):
        # 40/100 = 0.40 -> NOT < 0.4 -> not detected
        vals = [100.0] * 6 + [40.0, 40.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is False

    def test_just_below_threshold_detected(self):
        vals = [100.0] * 6 + [39.0, 39.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is True

    def test_normal_traffic_not_detected(self):
        vals = [100.0] * 6 + [95.0, 90.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is False

    def test_partial_drop_not_detected(self):
        # 50% drop — above threshold
        vals = [100.0] * 6 + [50.0, 50.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is False

    def test_insufficient_data(self):
        result = detect_outage_from_timeseries(_ts([100.0] * 7))
        assert result["detected"] is False
        assert result["reason"] == "insufficient_data"

    def test_no_baseline(self):
        vals = [None] * 6 + [35.0, 35.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is False
        assert result["reason"] == "no_baseline"

    def test_zero_baseline(self):
        vals = [0.0] * 6 + [0.0, 0.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["detected"] is False
        assert result["reason"] == "zero_baseline"

    def test_empty_values(self):
        result = detect_outage_from_timeseries(_ts([]))
        assert result["detected"] is False
        assert result["reason"] == "insufficient_data"

    def test_drop_count_correct(self):
        vals = [100.0] * 6 + [30.0, 25.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["drop_count"] == 2

    def test_worst_ratio_is_minimum(self):
        vals = [100.0] * 6 + [30.0, 20.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["worst_ratio"] == pytest.approx(0.2, abs=0.001)

    def test_first_drop_at_correct_timestamp(self):
        vals = [100.0] * 6 + [30.0, 25.0]
        result = detect_outage_from_timeseries(_ts(vals))
        assert result["first_drop_at"] == "t6"

    def test_provider_in_result(self):
        vals = [100.0] * 6 + [30.0, 25.0]
        result = detect_outage_from_timeseries(_ts(vals, provider="Inter"))
        assert result["provider"] == "Inter"

    def test_nulls_in_recent_ignored(self):
        vals = [100.0] * 6 + [None, 30.0]
        result = detect_outage_from_timeseries(_ts(vals))
        # Only one non-null recent value that drops
        assert result["detected"] is True
        assert result["drop_count"] == 1

    def test_missing_timestamps_handled(self):
        ts = {"asn": "8048", "provider": "CANTV", "values": [100.0] * 6 + [30.0, 25.0]}
        result = detect_outage_from_timeseries(ts)
        assert result["detected"] is True


# ── fetch_traffic_timeseries_by_asn ──────────────────────────────────────────

class TestFetchTimeseries:
    def test_happy_path_shape(self):
        payload = {"result": {"httpRequests": {
            "timestamps": ["t1", "t2"],
            "values":     [100.0, 95.0],
        }}}
        result = fetch_traffic_timeseries_by_asn("8048", _session=_session(_mock_resp(payload)))
        assert result["asn"] == "8048"
        assert result["provider"] == "CANTV"
        assert result["timestamps"] == ["t1", "t2"]
        assert result["values"] == [100.0, 95.0]

    def test_unknown_asn_provider(self):
        payload = {"result": {"httpRequests": {"timestamps": [], "values": []}}}
        result = fetch_traffic_timeseries_by_asn("99999", _session=_session(_mock_resp(payload)))
        assert result["provider"] == "Unknown"

    def test_timeout_returns_empty(self):
        result = fetch_traffic_timeseries_by_asn("8048", _session=_session(Exception("timeout")))
        assert result["values"] == []
        assert result["timestamps"] == []
        assert "error" in result

    def test_http_error_returns_empty(self):
        result = fetch_traffic_timeseries_by_asn("8048", _session=_session(_mock_resp({}, 503)))
        assert result["values"] == []

    def test_missing_http_requests_key(self):
        result = fetch_traffic_timeseries_by_asn("8048", _session=_session(_mock_resp({"result": {}})))
        assert result["values"] == []
        assert result["timestamps"] == []


# ── fetch_traffic_anomalies ───────────────────────────────────────────────────

class TestFetchAnomalies:
    def _anomaly(self, asn="8048", name="CANTV"):
        return {
            "type": "OUTAGE",
            "asnDetails": {"asn": asn, "name": name},
            "startDate": "2026-05-16T10:00:00Z",
            "endDate": None,
            "locationDetails": {"code": "VE"},
            "visibleInDataSources": ["AGGREGATED_HTTP_REQUESTS"],
        }

    def test_returns_list_of_anomalies(self):
        payload = {"result": {"trafficAnomalies": [self._anomaly()]}}
        result = fetch_traffic_anomalies(_session=_session(_mock_resp(payload)))
        assert len(result) == 1
        assert result[0]["type"] == "OUTAGE"
        assert result[0]["asn"] == "8048"
        assert result[0]["location"] == "VE"

    def test_empty_result(self):
        payload = {"result": {"trafficAnomalies": []}}
        result = fetch_traffic_anomalies(_session=_session(_mock_resp(payload)))
        assert result == []

    def test_timeout_returns_empty_list(self):
        result = fetch_traffic_anomalies(_session=_session(Exception("timeout")))
        assert result == []

    def test_http_error_returns_empty_list(self):
        result = fetch_traffic_anomalies(_session=_session(_mock_resp({}, 503)))
        assert result == []

    def test_multiple_anomalies(self):
        payload = {"result": {"trafficAnomalies": [
            self._anomaly("8048", "CANTV"),
            self._anomaly("21826", "Inter"),
        ]}}
        result = fetch_traffic_anomalies(_session=_session(_mock_resp(payload)))
        assert len(result) == 2
        assert result[1]["asn_name"] == "Inter"
