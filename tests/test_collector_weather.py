"""
Tests for pipeline/collector_weather.py. All offline.
"""
import pytest
from unittest.mock import MagicMock, call

from pipeline.collector_weather import (
    CITIES,
    _parse_city_response,
    compute_heat_stress,
    fetch_weather_stress,
)

# ── compute_heat_stress ───────────────────────────────────────────────────────

class TestComputeHeatStress:
    def test_no_stress(self):
        assert compute_heat_stress(30.0, 60.0) == 0

    def test_temp_above_33(self):
        assert compute_heat_stress(34.0, 60.0) == 1

    def test_temp_exactly_33_no_increment(self):
        assert compute_heat_stress(33.0, 60.0) == 0

    def test_temp_above_36(self):
        # >36 adds another point (stacks with >33)
        assert compute_heat_stress(37.0, 60.0) == 2

    def test_temp_exactly_36_no_second_increment(self):
        assert compute_heat_stress(36.0, 60.0) == 1  # only >33 fires

    def test_humidity_above_70(self):
        assert compute_heat_stress(30.0, 71.0) == 1

    def test_humidity_exactly_70_no_increment(self):
        assert compute_heat_stress(30.0, 70.0) == 0

    def test_max_score_all_three(self):
        assert compute_heat_stress(37.0, 75.0) == 3

    def test_temp_and_humidity_no_extreme_temp(self):
        assert compute_heat_stress(34.0, 75.0) == 2  # >33 + hum>70

    def test_score_range_never_exceeds_3(self):
        assert compute_heat_stress(50.0, 100.0) == 3


# ── _parse_city_response ──────────────────────────────────────────────────────

class TestParseCityResponse:
    def _make_data(self, max_temp=35.0, humidity=72.0, precip=1.5):
        return {
            "properties": {
                "parameter": {
                    "T2M_MAX":       {"20260514": max_temp},
                    "RH2M":          {"20260514": humidity},
                    "PRECTOTCORR":   {"20260514": precip},
                }
            }
        }

    def test_happy_path(self):
        result = _parse_city_response(self._make_data(37.0, 75.0, 2.0))
        assert result["max_temp_c"]       == pytest.approx(37.0)
        assert result["humidity_pct"]     == pytest.approx(75.0)
        assert result["precipitation_mm"] == pytest.approx(2.0)

    def test_uses_last_value(self):
        data = {"properties": {"parameter": {
            "T2M_MAX":     {"20260514": 30.0, "20260515": 38.0},
            "RH2M":        {"20260514": 60.0, "20260515": 80.0},
            "PRECTOTCORR": {"20260514": 0.0,  "20260515": 3.0},
        }}}
        result = _parse_city_response(data)
        assert result["max_temp_c"] == pytest.approx(38.0)

    def test_missing_properties_returns_none(self):
        assert _parse_city_response({}) is None

    def test_empty_parameter_returns_none(self):
        data = {"properties": {"parameter": {"T2M_MAX": {}, "RH2M": {}, "PRECTOTCORR": {}}}}
        assert _parse_city_response(data) is None

    def test_wrong_type_returns_none(self):
        assert _parse_city_response("not a dict") is None


# ── fetch_weather_stress ──────────────────────────────────────────────────────

def _mock_resp(max_temp=35.0, humidity=72.0, precip=1.0, status=200):
    r = MagicMock()
    r.raise_for_status.side_effect = None if status < 400 else Exception(f"HTTP {status}")
    r.json.return_value = {
        "properties": {"parameter": {
            "T2M_MAX":     {"20260515": max_temp},
            "RH2M":        {"20260515": humidity},
            "PRECTOTCORR": {"20260515": precip},
        }}
    }
    return r


def _session_ok(max_temp=35.0, humidity=72.0):
    s = MagicMock()
    s.get.return_value = _mock_resp(max_temp, humidity)
    return s


class TestFetchWeatherStress:
    def test_happy_path_all_four_cities(self):
        result = fetch_weather_stress(_session=_session_ok())
        assert set(result.keys()) == set(CITIES.keys())

    def test_heat_stress_score_present(self):
        result = fetch_weather_stress(_session=_session_ok(37.0, 75.0))
        for city in CITIES:
            assert "heat_stress_score" in result[city]

    def test_weather_score_is_heat_stress_div_3(self):
        result = fetch_weather_stress(_session=_session_ok(37.0, 75.0))
        for city in CITIES:
            hs = result[city]["heat_stress_score"]
            assert result[city]["weather_score"] == pytest.approx(hs / 3)

    def test_weather_score_range_0_to_1(self):
        result = fetch_weather_stress(_session=_session_ok(37.0, 75.0))
        for city in CITIES:
            assert 0.0 <= result[city]["weather_score"] <= 1.0

    def test_timeout_on_one_city_others_returned(self):
        call_count = [0]
        s = MagicMock()
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 2:
                raise Exception("Connection timeout")
            return _mock_resp()
        s.get.side_effect = side_effect
        result = fetch_weather_stress(_session=s)
        assert len(result) == 3  # one city missing, three present

    def test_all_timeout_returns_empty(self):
        s = MagicMock()
        s.get.side_effect = Exception("timeout")
        result = fetch_weather_stress(_session=s)
        assert result == {}

    def test_http_error_skips_city(self):
        s = MagicMock()
        s.get.return_value = _mock_resp(status=503)
        result = fetch_weather_stress(_session=s)
        assert result == {}

    def test_required_keys_in_result(self):
        result = fetch_weather_stress(_session=_session_ok())
        for city in CITIES:
            entry = result[city]
            assert "max_temp_c"        in entry
            assert "humidity_pct"      in entry
            assert "precipitation_mm"  in entry
            assert "heat_stress_score" in entry
            assert "weather_score"     in entry

    def test_high_temp_high_humidity_max_score(self):
        result = fetch_weather_stress(_session=_session_ok(37.0, 75.0))
        for city in CITIES:
            assert result[city]["heat_stress_score"] == 3
            assert result[city]["weather_score"]     == pytest.approx(1.0)

    def test_low_temp_low_humidity_zero_score(self):
        result = fetch_weather_stress(_session=_session_ok(25.0, 50.0))
        for city in CITIES:
            assert result[city]["heat_stress_score"] == 0
            assert result[city]["weather_score"]     == pytest.approx(0.0)

    def test_date_str_used_in_request(self):
        s = _session_ok()
        fetch_weather_stress(date_str="2026-05-15", _session=s)
        params = s.get.call_args_list[0][1]["params"]
        assert params["start"] == "20260515"
        assert params["end"]   == "20260515"
