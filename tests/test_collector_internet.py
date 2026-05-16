"""
Tests for pipeline/collector_internet.py.

All tests run offline — no real HTTP calls.
requests.Session is injected via _session parameter.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from pipeline.collector_internet import (
    ASNS,
    extract_latest_score,
    fetch_ioda_signals,
)

# ── fixtures ──────────────────────────────────────────────────────────────────

NOW = datetime(2026, 5, 16, 12, 0, 0, tzinfo=timezone.utc)

def _mock_response(data: dict, status: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = data
    resp.raise_for_status.side_effect = (
        None if status < 400
        else Exception(f"HTTP {status}")
    )
    return resp


def _ioda_payload(values: list) -> dict:
    return {"data": [{"values": values}]}


def _make_session(responses: dict[str, MagicMock]) -> MagicMock:
    """responses keyed by ASN number string (e.g. '8048')."""
    session = MagicMock()
    def get_side_effect(url, **kwargs):
        for asn_num, resp in responses.items():
            if f"/asn/{asn_num}" in url:
                return resp
        return _mock_response({}, 200)
    session.get.side_effect = get_side_effect
    return session


# ── extract_latest_score ──────────────────────────────────────────────────────

class TestExtractLatestScore:
    def test_returns_last_non_null(self):
        data = _ioda_payload([0.90, 0.85, None, 0.72])
        assert extract_latest_score(data) == 0.72

    def test_skips_trailing_nulls(self):
        data = _ioda_payload([0.90, 0.85, None, None])
        assert extract_latest_score(data) == 0.85

    def test_all_nulls_returns_none(self):
        data = _ioda_payload([None, None, None])
        assert extract_latest_score(data) is None

    def test_empty_values_returns_none(self):
        data = _ioda_payload([])
        assert extract_latest_score(data) is None

    def test_empty_data_array_returns_none(self):
        assert extract_latest_score({"data": []}) is None

    def test_missing_data_key_returns_none(self):
        assert extract_latest_score({}) is None

    def test_score_rounded_to_3dp(self):
        data = _ioda_payload([0.9999999])
        assert extract_latest_score(data) == 1.0

    def test_score_at_zero(self):
        data = _ioda_payload([0.0])
        assert extract_latest_score(data) == 0.0

    def test_malformed_data_returns_none(self):
        assert extract_latest_score({"data": "not-a-list"}) is None

    def test_single_value(self):
        data = _ioda_payload([0.95])
        assert extract_latest_score(data) == 0.95


# ── fetch_ioda_signals ────────────────────────────────────────────────────────

class TestFetchIodaSignals:
    def test_all_four_asns_present(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        result = fetch_ioda_signals(now=NOW, _session=session)
        assert set(result.keys()) == set(ASNS.keys())

    def test_happy_path_score_in_range(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.95, 0.96, 0.94]))
        result = fetch_ioda_signals(now=NOW, _session=session)
        for asn in ASNS:
            score = result[asn]["score"]
            assert score is not None
            assert 0.0 <= score <= 1.0

    def test_provider_name_correct(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        result = fetch_ioda_signals(now=NOW, _session=session)
        assert result["AS8048"]["provider"] == "CANTV"
        assert result["AS21826"]["provider"] == "Inter"
        assert result["AS264731"]["provider"] == "Movistar VE"
        assert result["AS22313"]["provider"] == "Digitel"

    def test_timestamp_set(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        result = fetch_ioda_signals(now=NOW, _session=session)
        expected_ts = int(NOW.timestamp())
        for asn in ASNS:
            assert result[asn]["timestamp"] == expected_ts

    def test_timeout_yields_none_score_and_error(self):
        session = MagicMock()
        session.get.side_effect = Exception("Connection timeout")
        result = fetch_ioda_signals(now=NOW, _session=session)
        for asn in ASNS:
            assert result[asn]["score"] is None
            assert "error" in result[asn]

    def test_http_error_yields_none_score(self):
        session = MagicMock()
        session.get.return_value = _mock_response({}, status=503)
        result = fetch_ioda_signals(now=NOW, _session=session)
        for asn in ASNS:
            assert result[asn]["score"] is None

    def test_partial_failure_does_not_block_others(self):
        responses = {
            "8048":   _mock_response(_ioda_payload([0.95])),        # CANTV ok
            "21826":  MagicMock(side_effect=Exception("timeout")),  # Inter fails
            "264731": _mock_response(_ioda_payload([0.88])),        # Movistar ok
            "22313":  _mock_response(_ioda_payload([0.91])),        # Digitel ok
        }
        session = MagicMock()
        call_count = [0]
        def get_side_effect(url, **kwargs):
            for asn_num, resp in responses.items():
                if f"/asn/{asn_num}" in url:
                    if isinstance(resp, MagicMock) and resp.side_effect:
                        raise resp.side_effect
                    return resp
            return _mock_response({}, 200)
        session.get.side_effect = get_side_effect
        result = fetch_ioda_signals(now=NOW, _session=session)
        assert result["AS8048"]["score"] == 0.95
        assert result["AS21826"]["score"] is None
        assert result["AS264731"]["score"] == 0.88
        assert result["AS22313"]["score"] == 0.91

    def test_empty_data_returns_none_score(self):
        session = MagicMock()
        session.get.return_value = _mock_response({"data": []})
        result = fetch_ioda_signals(now=NOW, _session=session)
        for asn in ASNS:
            assert result[asn]["score"] is None

    def test_url_contains_correct_asn_number(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        fetch_ioda_signals(now=NOW, _session=session)
        called_urls = [call.args[0] for call in session.get.call_args_list]
        assert any("/asn/8048" in url for url in called_urls)
        assert any("/asn/21826" in url for url in called_urls)
        assert any("/asn/264731" in url for url in called_urls)
        assert any("/asn/22313" in url for url in called_urls)

    def test_url_contains_time_range(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        fetch_ioda_signals(now=NOW, _session=session)
        url = session.get.call_args_list[0].args[0]
        assert "?from=" in url
        assert "&until=" in url

    def test_now_defaults_to_current_utc(self):
        session = MagicMock()
        session.get.return_value = _mock_response(_ioda_payload([0.9]))
        result = fetch_ioda_signals(_session=session)
        # timestamp should be close to now
        import time
        for asn in ASNS:
            assert abs(result[asn].get("timestamp", 0) - time.time()) < 5
