"""
NASA POWER weather/grid-stress collector.

High temp + high humidity -> AC demand spike -> grid stress.
heat_stress_score 0-3; weather_score 0-1 for scorer.py blend.
No API key required (POWER is public).
"""
import logging
from datetime import date, timedelta

import requests

logger = logging.getLogger(__name__)

POWER_API = "https://power.larc.nasa.gov/api/temporal/daily/point"
TIMEOUT_S = 30

# 4 representative cities — covers coastal, inland, western grid zones
CITIES: dict[str, dict[str, float]] = {
    "caracas":        {"lat": 10.50, "lon": -66.92},
    "maracaibo":      {"lat": 10.63, "lon": -71.63},
    "valencia":       {"lat": 10.16, "lon": -68.01},
    "ciudad_guayana": {"lat":  8.37, "lon": -62.63},
}


def compute_heat_stress(max_temp_c: float, humidity_pct: float) -> int:
    """
    Return heat_stress_score 0-3.
    +1 if max_temp_c > 33, +1 if > 36, +1 if humidity_pct > 70.
    """
    score = 0
    if max_temp_c > 33:
        score += 1
    if max_temp_c > 36:
        score += 1
    if humidity_pct > 70:
        score += 1
    return score


def _parse_city_response(data: dict) -> dict | None:
    """Extract latest-day values from NASA POWER JSON. None on bad shape."""
    try:
        params = data["properties"]["parameter"]
        def latest(key: str) -> float:
            vals = list(params.get(key, {}).values())
            return float(vals[-1])
        max_temp = latest("T2M_MAX")
        humidity = latest("RH2M")
        precip   = latest("PRECTOTCORR")
        return {"max_temp_c": max_temp, "humidity_pct": humidity, "precipitation_mm": precip}
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def fetch_weather_stress(
    date_str: str | None = None,
    _session: requests.Session | None = None,
) -> dict[str, dict]:
    """
    Return per-city weather stress. Keyed by city name (subset of CITIES).

    Each entry: {max_temp_c, humidity_pct, precipitation_mm,
                 heat_stress_score (0-3), weather_score (0-1)}.
    City absent from result on timeout or parse failure.
    """
    if date_str is None:
        yesterday  = date.today() - timedelta(days=1)
        start_date = (yesterday - timedelta(days=1)).strftime("%Y%m%d")
        end_date   = yesterday.strftime("%Y%m%d")
    else:
        start_date = end_date = date_str.replace("-", "")

    session = _session or requests.Session()
    results: dict[str, dict] = {}

    for city, coords in CITIES.items():
        try:
            resp = session.get(
                POWER_API,
                params={
                    "parameters": "T2M,T2M_MAX,RH2M,PRECTOTCORR",
                    "community":  "RE",
                    "longitude":  coords["lon"],
                    "latitude":   coords["lat"],
                    "start":      start_date,
                    "end":        end_date,
                    "format":     "JSON",
                },
                timeout=TIMEOUT_S,
            )
            resp.raise_for_status()
            parsed = _parse_city_response(resp.json())
            if parsed is None:
                logger.warning("POWER %s: unexpected response shape", city)
                continue
            hs = compute_heat_stress(parsed["max_temp_c"], parsed["humidity_pct"])
            results[city] = {
                **parsed,
                "heat_stress_score": hs,
                "weather_score":     round(hs / 3, 3),
            }
        except Exception as exc:
            logger.warning("POWER %s: %s", city, exc)

    return results
